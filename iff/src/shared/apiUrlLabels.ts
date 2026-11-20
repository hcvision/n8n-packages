/** Labels of the API URLs credential; shared by the credential fields and the messages that refer to them. */
export const apiUrlsCredentialLabel = 'API URLs';
export const apiBaseUrlLabel = 'API Base URL';
export const apiBasePathLabel = 'API Base Path';

/** Points users to the credential field they have to correct. */
export function checkInCredentialHint(): string {
	return `Check it in the ${apiUrlsCredentialLabel} credentials.`;
}
