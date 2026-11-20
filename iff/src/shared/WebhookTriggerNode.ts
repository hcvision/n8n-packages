import { createHmac, timingSafeEqual } from 'node:crypto';

import type {
	IDataObject,
	IHookFunctions,
	IHttpRequestMethods,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IPollFunctions,
	IWebhookFunctions,
	IWebhookResponseData,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import { readApiBasePath } from './apiUrl';
import { apiBasePathLabel, apiUrlsCredentialLabel, checkInCredentialHint } from './apiUrlLabels';
import { validateApiBaseUrl } from './request';

/** An event a trigger node can start a workflow on. */
export interface WebhookTriggerEvent {
	name: string;
	value: string;
	description: string;
	action: string;
}

/** Describes one generated webhook trigger node for the shared node factory. */
export interface WebhookTriggerConfig {
	displayName: string;
	name: string;
	description: string;
	moduleVersion: string;
	apiBaseUrlCredentialType: string;
	credentialType: string;
	webhookApiBasePathField: string;
	webhookApiBasePath: string;
	icon: INodeTypeDescription['icon'];
	events: WebhookTriggerEvent[];
	operations: Record<WebhookOperationKey, WebhookOperation>;
}

/** Endpoint of the webhook service as published in its OpenAPI specification. */
export interface WebhookOperation {
	method: IHttpRequestMethods;
	path: string;
}

export type WebhookOperationKey =
	| 'listSubscriptions'
	| 'createSubscription'
	| 'deleteSubscription'
	| 'recoverSubscription'
	| 'redeliverSubscription'
	| 'testSubscription'
	| 'rotateSubscriptionSecret'
	| 'listEvents';

interface SubscriptionResponse {
	subscriptionId: string;
	targetUrl: string;
	eventTypes: string[];
}

interface CreateSubscriptionResponse {
	subscriptionId: string;
	secret: string;
}

interface TestSubscriptionResponse {
	isSuccess: boolean;
	statusCode?: number | null;
}

interface RotateSubscriptionSecretResponse {
	secret: string;
}

interface RecoverSubscriptionResponse {
	hasMore: boolean;
	nextCursor?: number | null;
}

interface EventsPageResponse {
	page: {
		items: Array<{ sequence: number }>;
		nextCursor?: number | null;
	};
}

interface RedeliverSubscriptionResponse {
	hasMore: boolean;
	nextCursor?: number | null;
}

type ApiContext = IHookFunctions | IWebhookFunctions | IPollFunctions;

interface TriggerStaticData extends IDataObject {
	subscriptionId?: string;
	secret?: string;
	secretCreatedAt?: number;
	lastCatchUpAt?: number;
	seenEventIds?: string[];
}

// The test run executes the poll function in another workflow instance, so the event is kept per process.
const testEvents = new Map<string, IDataObject>();

function testEventKey(context: IWebhookFunctions | IPollFunctions): string {
	return `${context.getWorkflow().id}:${context.getNode().name}`;
}

interface ApiResponse<T> {
	statusCode: number;
	body: T;
}

const webhookName = 'default';
const signatureToleranceSeconds = 300;
const maxSeenEventIds = 500;
const maxRecoverPages = 50;
const maxEventPages = 200;
const maxRedeliverPages = 10;
const catchUpIntervalMs = 15 * 60 * 1000;
const secretRotationIntervalMs = 90 * 24 * 60 * 60 * 1000;
// Both secrets sign during the grace period, so it only has to cover the time until the new one is stored.
const secretRotationGracePeriodMinutes = 120;

/** Subtitle that shows the display name of the selected event instead of its technical value. */
function eventSubtitle(events: readonly WebhookTriggerEvent[]): string {
	const namesByValue = Object.fromEntries(events.map((event) => [event.value, event.name]));
	const lookup = JSON.stringify(namesByValue);

	return `={{ ${lookup}[$parameter["event"]] }}`;
}

/** Creates the n8n node description of a webhook trigger node. */
export function createTriggerDescription(config: WebhookTriggerConfig): INodeTypeDescription {
	return {
		displayName: config.displayName,
		name: config.name,
		icon: config.icon,
		group: ['trigger'],
		polling: true,
		version: 1,
		subtitle: eventSubtitle(config.events),
		communityNodePackageVersion: config.moduleVersion,
		description: config.description,
		defaults: { name: config.displayName },
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: config.apiBaseUrlCredentialType,
				displayName: apiUrlsCredentialLabel,
				required: true,
			},
			{
				name: config.credentialType,
				displayName: 'Employee IAM',
				required: true,
			},
		],
		webhooks: [
			{
				name: webhookName,
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'webhook',
			},
		],
		properties: [
			// The options come from the generated config, which the linter cannot evaluate.

			{
				displayName: 'Trigger',
				name: 'event',
				type: 'options',
				noDataExpression: true,
				required: true,
				default: config.events[0].value,
				description: 'Event that starts the workflow',
				options: config.events,
			},
			{
				displayName: 'Simplify',
				name: 'simplify',
				type: 'boolean',
				default: true,
				description:
					'Whether to return only the event data instead of the full event with its ID, type, and timestamp',
			},
		],
	};
}

/**
 * Creates the hooks that register the subscription at the webhook service when the workflow is
 * activated and remove it when the workflow is deactivated.
 */
export function createWebhookMethods(
	config: WebhookTriggerConfig,
): NonNullable<INodeType['webhookMethods']> {
	return {
		[webhookName]: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const staticData = this.getWorkflowStaticData('node') as TriggerStaticData;
				const subscription = await findSubscription(this, config);
				if (!subscription) {
					clearStaticData(staticData);

					return false;
				}

				const events = [selectedEvent(this)];
				if (
					subscription.subscriptionId !== staticData.subscriptionId ||
					!staticData.secret ||
					!sameEvents(subscription.eventTypes, events)
				) {
					await deleteSubscription(this, config, subscription.subscriptionId);
					clearStaticData(staticData);

					return false;
				}

				if (
					this.getMode() !== 'manual' &&
					!(await isSecretAccepted(this, config, subscription.subscriptionId))
				) {
					await deleteSubscription(this, config, subscription.subscriptionId);
					clearStaticData(staticData);

					return false;
				}

				await catchUpMissedEvents(this, config, subscription.subscriptionId, staticData);

				return true;
			},

			async create(this: IHookFunctions): Promise<boolean> {
				const staticData = this.getWorkflowStaticData('node') as TriggerStaticData;
				const events = [selectedEvent(this)];
				const recoverFromSequence = await readLastSequence(this, config);
				const workflow = this.getWorkflow();
				const response = await apiRequest<CreateSubscriptionResponse>(
					this,
					config,
					'createSubscription',
					{
						body: {
							name: `n8n: ${workflow.name ?? workflow.id ?? ''} / ${this.getNode().name}`.slice(
								0,
								200,
							),
							targetUrl: webhookUrl(this),
							eventTypes: events,
						},
					},
				);

				staticData.subscriptionId = response.body.subscriptionId;
				staticData.secret = response.body.secret;
				staticData.secretCreatedAt = Date.now();
				staticData.recoverFromSequence = recoverFromSequence;
				staticData.seenEventIds = [];

				return true;
			},

			async delete(this: IHookFunctions): Promise<boolean> {
				const staticData = this.getWorkflowStaticData('node') as TriggerStaticData;
				const subscriptionId =
					staticData.subscriptionId ?? (await findSubscription(this, config))?.subscriptionId;

				if (subscriptionId) {
					await deleteSubscription(this, config, subscriptionId);
				}

				clearStaticData(staticData);

				return true;
			},
		},
	};
}

/** Verifies the Standard Webhooks signature of a delivery and starts the workflow once per event. */
export async function handleWebhook(
	context: IWebhookFunctions,
	config: WebhookTriggerConfig,
): Promise<IWebhookResponseData> {
	const staticData = context.getWorkflowStaticData('node') as TriggerStaticData;
	const request = context.getRequestObject();
	const rawBody = request.rawBody as Buffer | undefined;
	const eventId = headerValue(request.headers['webhook-id']);
	const timestamp = headerValue(request.headers['webhook-timestamp']);
	const signature = headerValue(request.headers['webhook-signature']);

	if (
		!staticData.secret ||
		!rawBody ||
		!eventId ||
		!timestamp ||
		!signature ||
		!isValidSignature(staticData.secret, eventId, timestamp, rawBody, signature)
	) {
		context.logger.warn('Webhook delivery rejected: invalid signature or missing headers', {
			hasSecret: Boolean(staticData.secret),
			hasRawBody: Boolean(rawBody),
			eventId,
			timestamp,
		});

		context.getResponseObject().status(401).json({ message: 'Invalid signature' });

		return { noWebhookResponse: true };
	}

	const seen = staticData.seenEventIds ?? [];
	if (seen.includes(eventId)) {
		context.logger.warn('Webhook delivery ignored: event already processed', { eventId });

		return { webhookResponse: { status: 'duplicate' } };
	}

	const event = parseEvent(context, rawBody);
	if (event.type !== selectedEvent(context)) {
		context.logger.warn('Webhook delivery ignored: event type does not match the trigger', {
			eventId,
			receivedType: event.type,
			expectedType: selectedEvent(context),
		});

		return { webhookResponse: { status: 'ignored' } };
	}

	staticData.seenEventIds = [...seen, eventId].slice(-maxSeenEventIds);
	await rotateSecretWhenDue(context, config, staticData);
	const output = context.getNodeParameter('simplify', true)
		? (event.data as IDataObject)
		: ({
				id: eventId,
				type: event.type,
				timestamp: event.timestamp,
				data: event.data,
			} as IDataObject);

	// In test runs n8n executes the poll function of a polling node instead of passing the webhook data through.
	if (context.getMode() === 'manual') {
		testEvents.set(testEventKey(context), output);
	}

	return { workflowData: [context.helpers.returnJsonArray(output)] };
}

/** Checks the `v1` signatures of a delivery; during a secret rotation the header holds several. */
export function isValidSignature(
	secret: string,
	eventId: string,
	timestamp: string,
	rawBody: Buffer,
	signatureHeader: string,
	nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
	const timestampSeconds = Number(timestamp);
	if (
		!Number.isInteger(timestampSeconds) ||
		Math.abs(nowSeconds - timestampSeconds) > signatureToleranceSeconds
	) {
		return false;
	}

	const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
	const expected = createHmac('sha256', key)
		.update(`${eventId}.${timestamp}.`)
		.update(rawBody)
		.digest();

	return signatureHeader.split(' ').some((candidate) => {
		const separator = candidate.indexOf(',');
		if (separator < 0 || candidate.slice(0, separator) !== 'v1') return false;
		const actual = Buffer.from(candidate.slice(separator + 1), 'base64');

		return actual.length === expected.length && timingSafeEqual(actual, expected);
	});
}

function headerValue(value: string | string[] | undefined): string | undefined {
	return Array.isArray(value) ? value[0] : value;
}

function parseEvent(context: IWebhookFunctions, rawBody: Buffer): IDataObject {
	try {
		return JSON.parse(rawBody.toString('utf8')) as IDataObject;
	} catch (error) {
		throw new NodeOperationError(
			context.getNode(),
			`The webhook body is not valid JSON: ${(error as Error).message}`,
		);
	}
}

function selectedEvent(context: IHookFunctions | IWebhookFunctions): string {
	return context.getNodeParameter('event') as string;
}

function webhookUrl(context: IHookFunctions): string {
	const url = context.getNodeWebhookUrl(webhookName);
	if (!url) {
		throw new NodeOperationError(
			context.getNode(),
			'The webhook URL could not be determined. Check the webhook URL configuration of your n8n instance.',
		);
	}

	return url;
}

function validateWebhookApiBaseUrl(context: ApiContext, apiBaseUrl: unknown): string {
	try {
		return validateApiBaseUrl(String(apiBaseUrl)).replace(/\/+$/, '');
	} catch (error) {
		throw new NodeOperationError(context.getNode(), (error as Error).message);
	}
}

function sameEvents(left: string[], right: string[]): boolean {
	const normalize = (events: string[]) =>
		[...new Set(events.map((event) => event.toLowerCase()))].sort().join(';');

	return normalize(left) === normalize(right);
}

function clearStaticData(staticData: TriggerStaticData): void {
	delete staticData.subscriptionId;
	delete staticData.secret;
	delete staticData.secretCreatedAt;
	delete staticData.recoverFromSequence;
	delete staticData.seenEventIds;
	delete staticData.lastCatchUpAt;
}

async function findSubscription(
	context: IHookFunctions,
	config: WebhookTriggerConfig,
): Promise<SubscriptionResponse | undefined> {
	const targetUrl = webhookUrl(context);
	const response = await apiRequest<SubscriptionResponse[]>(context, config, 'listSubscriptions', {
		qs: { targetUrl },
	});

	return response.body.find((subscription) => subscription.targetUrl === targetUrl);
}

async function deleteSubscription(
	context: IHookFunctions,
	config: WebhookTriggerConfig,
	subscriptionId: string,
): Promise<void> {
	await apiRequest(context, config, 'deleteSubscription', {
		id: subscriptionId,
		acceptedStatusCodes: [404],
	});
}

/** Determines the newest stored sequence, so only events after the subscription are recovered later. */
async function readLastSequence(
	context: ApiContext,
	config: WebhookTriggerConfig,
): Promise<number | undefined> {
	try {
		let after = 0;
		let last = 0;
		for (let page = 0; page < maxEventPages; page++) {
			const response = await apiRequest<EventsPageResponse>(context, config, 'listEvents', {
				qs: { after, limit: 1000 },
			});

			const events = response.body.page.items;
			last = events.length > 0 ? events[events.length - 1].sequence : last;
			if (!response.body.page.nextCursor) return last;
			after = response.body.page.nextCursor;
		}
	} catch {
		// Without a cursor the recovery is skipped; no history is delivered by mistake.
	}

	return undefined;
}

/**
 * Sends a test event through the webhook service. The secret of the subscription cannot be read back, so a
 * 401 of this node means it was rotated outside of n8n and the subscription has to be created again. Any other
 * outcome, e.g. n8n not being reachable yet, is no proof of a stale secret.
 */
async function isSecretAccepted(
	context: IHookFunctions,
	config: WebhookTriggerConfig,
	subscriptionId: string,
): Promise<boolean> {
	try {
		const response = await apiRequest<TestSubscriptionResponse>(
			context,
			config,
			'testSubscription',
			{
				id: subscriptionId,
			},
		);

		return response.body.statusCode !== 401;
	} catch {
		return true;
	}
}

/** Delivers events the subscription missed while n8n was not reachable: missing and failed deliveries. */
async function catchUpMissedEvents(
	context: ApiContext,
	config: WebhookTriggerConfig,
	subscriptionId: string,
	staticData: TriggerStaticData,
): Promise<void> {
	staticData.lastCatchUpAt = Date.now();
	await recoverMissingDeliveries(context, config, subscriptionId, staticData);
	await redeliverFailedDeliveries(context, config, subscriptionId);
}

/**
 * Creates the deliveries that do not exist yet. Existing ones stay unchanged, so failed deliveries need a redelivery.
 */
async function recoverMissingDeliveries(
	context: ApiContext,
	config: WebhookTriggerConfig,
	subscriptionId: string,
	staticData: TriggerStaticData,
): Promise<void> {
	if (staticData.recoverFromSequence === undefined) return;

	try {
		let fromSequence = staticData.recoverFromSequence;
		for (let page = 0; page < maxRecoverPages; page++) {
			const response = await apiRequest<RecoverSubscriptionResponse>(
				context,
				config,
				'recoverSubscription',
				{ id: subscriptionId, body: { fromSequence } },
			);

			if (!response.body.hasMore || !response.body.nextCursor) {
				// Events delivered since are filtered by their id, so the next recovery can start here.
				staticData.recoverFromSequence =
					(await readLastSequence(context, config)) ?? staticData.recoverFromSequence;

				return;
			}

			fromSequence = response.body.nextCursor;
		}
	} catch {
		// Recovery is best effort; the activation of the workflow must not fail because of it.
	}
}

/** Queues the deliveries again that ran out of retries, e.g. because n8n was down for longer than the retry chain. */
async function redeliverFailedDeliveries(
	context: ApiContext,
	config: WebhookTriggerConfig,
	subscriptionId: string,
): Promise<void> {
	try {
		let fromSequence = 0;
		for (let page = 0; page < maxRedeliverPages; page++) {
			const response = await apiRequest<RedeliverSubscriptionResponse>(
				context,
				config,
				'redeliverSubscription',
				{ id: subscriptionId, body: { status: 'Failed', fromSequence } },
			);

			if (!response.body.hasMore || !response.body.nextCursor) return;

			fromSequence = response.body.nextCursor;
		}
	} catch {
		// Best effort like the recovery; the next run tries again.
	}
}

/** Timer: catches up missed events while the workflow is active, throttled to the catch-up interval. */
export async function handlePoll(
	context: IPollFunctions,
	config: WebhookTriggerConfig,
): Promise<INodeExecutionData[][] | null> {
	const staticData = context.getWorkflowStaticData('node') as TriggerStaticData;

	if (context.getMode() === 'manual') {
		const key = testEventKey(context);
		const testEvent = testEvents.get(key);
		testEvents.delete(key);

		return testEvent ? [context.helpers.returnJsonArray(testEvent)] : null;
	}

	if (
		staticData.subscriptionId &&
		Date.now() - (staticData.lastCatchUpAt ?? 0) >= catchUpIntervalMs
	) {
		await catchUpMissedEvents(context, config, staticData.subscriptionId, staticData);
	}

	return null;
}

/**
 * Replaces the secret once it is older than the rotation interval. It runs after a delivery was verified, so only the
 * webhook service can trigger it. The new secret is stored before anything else, because it is only returned once.
 */
async function rotateSecretWhenDue(
	context: IWebhookFunctions,
	config: WebhookTriggerConfig,
	staticData: TriggerStaticData,
): Promise<void> {
	if (staticData.secretCreatedAt === undefined) {
		staticData.secretCreatedAt = Date.now();

		return;
	}

	if (
		!staticData.subscriptionId ||
		Date.now() - staticData.secretCreatedAt < secretRotationIntervalMs
	) {
		return;
	}

	try {
		const response = await apiRequest<RotateSubscriptionSecretResponse>(
			context,
			config,
			'rotateSubscriptionSecret',
			{
				id: staticData.subscriptionId,
				body: { gracePeriodMinutes: secretRotationGracePeriodMinutes },
			},
		);

		staticData.secret = response.body.secret;
		staticData.secretCreatedAt = Date.now();
	} catch {
		// The delivery must not fail because of it; the next verified delivery tries again.
	}
}

interface ApiRequestOptions {
	id?: string;
	body?: IDataObject;
	qs?: IDataObject;
	acceptedStatusCodes?: number[];
}

async function apiRequest<T>(
	context: ApiContext,
	config: WebhookTriggerConfig,
	operationKey: WebhookOperationKey,
	options: ApiRequestOptions = {},
): Promise<ApiResponse<T>> {
	const { id, body, qs, acceptedStatusCodes = [] } = options;
	const operation = config.operations[operationKey];
	const path = operation.path.replace('{id}', encodeURIComponent(id ?? ''));
	const credentials = await context.getCredentials(config.apiBaseUrlCredentialType);
	const apiBaseUrl = validateWebhookApiBaseUrl(context, credentials.apiBaseUrl);
	const apiBasePath = readApiBasePath(
		credentials,
		config.webhookApiBasePathField,
		config.webhookApiBasePath,
	);

	if (!apiBasePath.startsWith('/')) {
		throw new NodeOperationError(
			context.getNode(),
			`'${apiBasePathLabel}' for webhooks must start with a slash. ${checkInCredentialHint()}`,
		);
	}

	const response = (await context.helpers.httpRequestWithAuthentication.call(
		context,
		config.credentialType,
		{
			method: operation.method,
			url: `${apiBaseUrl}${apiBasePath.replace(/\/+$/, '')}${path}`,
			headers: { Accept: 'application/json' },
			body,
			qs,
			json: true,
			returnFullResponse: true,
			ignoreHttpStatusErrors: true,
		},
	)) as ApiResponse<T>;

	if (response.statusCode >= 400 && !acceptedStatusCodes.includes(response.statusCode)) {
		throw new NodeOperationError(
			context.getNode(),
			`The webhook service returned status ${response.statusCode}`,
			{ description: JSON.stringify(response.body) },
		);
	}

	return response;
}
