import FakeStorage from "./FakeStorage";

/**
 * An interface to a local storage back settings store with a versioning mechanism
 */
class Settings {
  name;
  currentVersion;
  storage;

  constructor(name) {
    this.name = name;
    // Try and use local storage if it is available, if not mock it with an in memory storage
    try {
      localStorage.setItem("__test", "__test");
      localStorage.removeItem("__test");
      this.storage = localStorage;
    } catch (e) {
      console.warn("Local storage is disabled, no settings will be saved");
      this.storage = new FakeStorage();
    }
    this.currentVersion = this.get("__version");
  }

  version(versionNumber, upgradeFunction) {
    if (versionNumber > this.currentVersion) {
      this.currentVersion = versionNumber;
      this.setAll(upgradeFunction(this.getAll()));
    }
  }

  getAll() {
    return JSON.parse(this.storage.getItem(this.name));
  }

  get(key) {
    const settings = this.getAll();
    return settings && settings[key];
  }

  setAll(newSettings) {
    this.storage.setItem(
      this.name,
      JSON.stringify({ ...newSettings, __version: this.currentVersion })
    );
  }

  set(key, value) {
    let settings = this.getAll();
    settings[key] = value;
    this.setAll(settings);
  }
}

export default Settings;
