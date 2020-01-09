class ObnizStroage {
  constructor(name) {
    this.cloudStorageFileName = name || 'bockprogram_storage.json';
  }

  /**
   * 互換性のために残す
   */
  async _createStorage() {
    this._storageCache = {};
    let form = new FormData();
    form.append('file', new Blob([JSON.stringify(this._storageCache)]), this.cloudStorageFileName);
    await fetch('/users/me/repo/' + this.cloudStorageFileName, {
      method: "POST",
      body: form,
      credentials: "include"
    })
  }

  async prepareStorage() {
    if (this._storageCache) {
      return;
    }
    let response;
    response = await fetch('/users/me/repo/' + this.cloudStorageFileName, {method: "GET", credentials: "include"})
    if (response.status === 200) {
      this._storageCache = await response.json();
    } else if (response.status === 404) {
      await this._createStorage();
    } else if (response.status === 403) {
      throw new Error('please login')
    } else {
      throw new Error('cloud storage access error(' + response.status + ')')
    }
  }

  async saveToStorage(key, value) {
    await this.prepareStorage();
    this._storageCache[key] = value;
    let form = new FormData();
    form.append('file', new Blob([JSON.stringify(this._storageCache)]), this.cloudStorageFileName);

    await fetch('/users/me/repo/' + this.cloudStorageFileName, {
      method: "POST",
      body: form,
      credentials: "include"
    })
  }

  async loadFromStorage(key) {
    await this.prepareStorage();
    return this._storageCache[key];
  }

}

if (typeof module === 'object') {
  module.exports = ObnizStroage;
} else {
  _obnizStorage = new ObnizStroage();
}