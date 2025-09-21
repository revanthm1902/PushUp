// Storage helper utility to handle both development and production chrome.storage usage
export class StorageHelper {
  static async get(keys: string[] | string): Promise<{ [key: string]: unknown }> {
    return new Promise((resolve) => {
      chrome.storage.local.get(keys, (result) => {
        resolve(result);
      });
    });
  }

  static async set(items: { [key: string]: unknown }): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.local.set(items, () => {
        resolve();
      });
    });
  }

  static async remove(key: string): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.local.remove(key, () => {
        resolve();
      });
    });
  }
}