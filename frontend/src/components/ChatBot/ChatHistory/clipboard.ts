export const copyToClipboard = (value: string): void => {
  try {
    navigator.clipboard.writeText(value);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Failed to copy to clipboard: ', err);
  }
};
