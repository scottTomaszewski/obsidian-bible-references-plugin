# Obsidian Bible Reference Plugin

![bible_reference_plugin_0 0 1](https://user-images.githubusercontent.com/5295276/121619998-8ba83200-ca37-11eb-8123-b948594d2fdc.gif)

I will get this plugin registered in the community plugins when there is some testing and stability. Until then...

## Basic Installation

1. Download the `obsidian-bible-reference-plugin-0.0.1.zip` archive from the latest tag
   here: https://github.com/scottTomaszewski/obsidian-bible-references-plugin/releases
2. Extract the archive to your `<vault_path>/.obsidian/plugins/` folder
3. Make sure you have community plugins enabled (Settings > Community Plugins > Safe Mode OFF)
4. Enable the Bible Reference Plugin (Settings > Community Plugins > toggle the plugin)
5. Add your ESV.org API token in the settings

## ESV.org API Token

The ESV.org API requires a token which you need to generate on their website after creating an
account (https://api.esv.org/account/create-application). I'll see about making one to share (there are API limits), but
for now you need your own. I think token generation is manual, so it may take a few days for them to respond.

## Manual Installation

- Clone your repo to a local development folder. For convenience, you can place this folder in
  your `<vault_path>/.obsidian/plugins/obsidian-bible-reference-plugin` folder.
- Install NodeJS, then run `npm i` in the command line under your repo folder.
- Run `npm run dev` to compile your plugin from `main.ts` to `main.js`.
- Make changes to `main.ts` (or create new `.ts` files). Those changes should be automatically compiled into `main.js`.
- Reload Obsidian to load the new version of your plugin.
- Enable plugin in settings window.
- For updates to the Obsidian API run `npm update` in the command line under your repo folder.

### Manually installing the plugin

- Copy over `main.js`, `styles.css`, `manifest.json` to your
  vault `VaultFolder/.obsidian/plugins/obsidian-bible-reference-plugin/`.
