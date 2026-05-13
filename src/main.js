import { Notice, Plugin, PluginSettingTab, Setting } from "./pluginWorker.js";

export default class MuteInFeedsPlugin extends Plugin {
  async onload() {
    const saved = await this.loadData();
    this.mutedAccounts = new Map(
      (saved?.accounts ?? []).map(({ did, handle }) => [did, handle]),
    );

    const addToggleItem = (menu, did, handle) => {
      const isMuted = this.mutedAccounts.has(did);
      menu.addItem((item) =>
        item
          .setTitle(isMuted ? "Unmute account in feeds" : "Mute account in feeds")
          .setIcon("lightning-bolt")
          .onClick(async () => {
            const wasMuted = this.mutedAccounts.has(did);
            if (wasMuted) {
              this.mutedAccounts.delete(did);
            } else {
              this.mutedAccounts.set(did, handle ?? null);
            }
            try {
              await this._persist();
              new Notice(
                wasMuted ? "Account unmuted in feeds" : "Account muted in feeds",
                3000,
              );
            } catch (error) {
              console.error(error);
              new Notice(
                wasMuted
                  ? "Failed to unmute account in feeds"
                  : "Failed to mute account in feeds",
                3000,
              ).noticeEl.addClass("error");
            }
          }),
      );
    };

    this.app.on("post-context-menu", (menu, post) => {
      const did = post?.author?.did;
      if (!did) return;
      if (did === this.app.currentUser?.did) return;
      addToggleItem(menu, did, post?.author?.handle);
    });

    this.app.on("profile-context-menu", (menu, profile) => {
      const did = profile?.did;
      if (!did) return;
      if (did === this.app.currentUser?.did) return;
      addToggleItem(menu, did, profile?.handle);
    });

    this.addSettingTab(new MuteInFeedsSettingTab());

    this.addFeedFilter("mute-in-feeds", (feedUri, feedItems) => {
      const decisions = {};
      for (const feedItem of feedItems) {
        const did = feedItem?.post?.author?.did;
        if (did && this.mutedAccounts.has(did)) {
          decisions[feedItem.post.uri] = false;
        }
      }
      return decisions;
    });
  }

  async _persist() {
    await this.saveData({
      accounts: [...this.mutedAccounts].map(([did, handle]) => ({ did, handle })),
    });
  }
}

class MuteInFeedsSettingTab extends PluginSettingTab {
  constructor() {
    super();
    this.name = "Mute in Feeds";
  }

  display() {
    this.containerEl.empty();
    this.containerEl.createEl("h3", { text: "Muted accounts" });

    if (this.plugin.mutedAccounts.size === 0) {
      this.containerEl.createEl("p", {
        text: "You haven't muted any accounts yet.",
      });
      return;
    }

    for (const [did, handle] of this.plugin.mutedAccounts) {
      new Setting(this.containerEl)
        .setName(handle ? `@${handle}` : did)
        .addButton((button) =>
          button.setButtonText("Unmute").onClick(async () => {
            this.plugin.mutedAccounts.delete(did);
            try {
              await this.plugin._persist();
              new Notice("Account unmuted in feeds", 3000);
            } catch (error) {
              console.error(error);
              new Notice("Failed to unmute account in feeds", 3000).noticeEl.addClass("error");
            }
            this.refresh();
          }),
        );
    }
  }
}
