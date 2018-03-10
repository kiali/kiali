class RefreshSettings {
  autoRefresh: boolean = true;
  interval: number = 30 * 1000; // hardcoded value for now
}

const refreshSettings = new RefreshSettings();
export { refreshSettings };
