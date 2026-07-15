const createLocalStorageAdapter = () => ({
  async get(key) {
    const value = localStorage.getItem(key);
    return value === null ? null : { value };
  },
  async set(key, value) {
    localStorage.setItem(key, String(value));
    return true;
  },
  async delete(key) {
    localStorage.removeItem(key);
    return true;
  },
  async list(prefix) {
    const keys = Object.keys(localStorage).filter((key) => key.startsWith(prefix));
    return { keys };
  }
});

if (!window.storage) {
  window.storage = createLocalStorageAdapter();
}

export async function loadStoredValue(key) {
  try {
    const res = await window.storage.get(key, false);
    return res && res.value ? JSON.parse(res.value) : null;
  } catch (error) {
    return null;
  }
}

export async function saveStoredValue(key, value) {
  await window.storage.set(key, JSON.stringify(value), false);
}

export async function loadStoredImages(prefix) {
  try {
    const listed = await window.storage.list(prefix, false);
    if (!listed || !listed.keys || !listed.keys.length) return {};

    const images = {};
    for (const key of listed.keys) {
      const res = await window.storage.get(key, false);
      if (res && res.value) {
        images[key.slice(prefix.length)] = res.value;
      }
    }
    return images;
  } catch (error) {
    return {};
  }
}

export async function setStoredImage(prefix, itemId, dataUrl) {
  await window.storage.set(prefix + itemId, dataUrl, false);
}

export async function deleteStoredImage(prefix, itemId) {
  await window.storage.delete(prefix + itemId, false);
}

export async function persistImportedImages(prefix, images) {
  await Promise.all(
    Object.keys(images).map((id) => setStoredImage(prefix, id, images[id]))
  );
}
