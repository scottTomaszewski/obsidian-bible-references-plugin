# Obsidian Bible Reference Plugin

![bible_reference_plugin_0 0 1](https://user-images.githubusercontent.com/5295276/121619998-8ba83200-ca37-11eb-8123-b948594d2fdc.gif)

I will get this plugin registered in the community plugins when there is some testing and stability. Until then...

## Basic Installation

1. Download the `obsidian-bible-reference-plugin-0.0.1.zip` archive from the latest tag
   here: https://github.com/scottTomaszewski/obsidian-bible-references-plugin/releases
2. Extract the archive to your `<vault_path>/.obsidian/plugins/` folder
3. Make sure you have community plugins enabled (Settings > Community Plugins > Safe Mode OFF)
4. Enable the Bible Reference Plugin (Settings > Community Plugins > toggle the plugin)

## ESV.org API Token

The ESV.org API requires a token to use.  A public token is provided by default, but there are caps imposed by ESV.org. 
For details on thresholds, see [https://api.esv.org/#conditions](https://api.esv.org/#conditions).  Please be
considerate and rate-limit yourselves to not exceed the threshold.  If caps are exceeded excessively, I will
implement limits and/or disable the public token.

If you plan on using this plugin to pull an excessive amount of passages, I would appreciate if you would generate your
own API token to avoid exceeding the threshold and locking out others using the public token. You can get a token by 
creating an account and requesting a token (https://api.esv.org/account/create-application). 

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
  vault `<vault_path>/.obsidian/plugins/obsidian-bible-reference-plugin/`.
