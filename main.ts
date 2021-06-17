import {App, DataWriteOptions, Plugin, PluginSettingTab, Setting} from 'obsidian';

interface BibleReferenceSettings {
    esvOrgApiToken: string;
    passageDirectory: string;
    embeddedPassageDirectory: string;
    footerLinkToChapter: boolean;
    footerLinkName: string;
    footerTagText: string;
    debugMode: boolean;

    linkParams: EsvApiParams;
    embeddedLinkParams: EsvApiParams;
}

interface EsvApiParams {
    includePassageReferences: boolean;
    includeVerseNumbers: boolean;
    includeFirstverseNumbers: boolean;
    includeFootnotes: boolean;
    includeFootnoteBody: boolean;
    includeHeadings: boolean;
    includeCssLink: boolean;
    inlineStyles: boolean;
    includeBookTitles: boolean;
    includeVerseAnchors: boolean;
    includeChapterNumbers: boolean;
    includeSubheadings: boolean;
    includeAudioLink: boolean;
    attachAudioLinkTo: string;
}

const DEFAULT_LINK_SETTINGS: EsvApiParams = {
    includePassageReferences: true,
    includeVerseNumbers: true,
    includeFirstverseNumbers: true,
    includeFootnotes: true,
    includeFootnoteBody: true,
    includeHeadings: true,
    includeCssLink: false,
    inlineStyles: false,
    includeBookTitles: false,
    includeVerseAnchors: false,
    includeChapterNumbers: true,
    includeSubheadings: true,
    includeAudioLink: true,
    attachAudioLinkTo: "passage",
}

const DEFAULT_EMBEDDED_LINK_SETTINGS: EsvApiParams = {
    includePassageReferences: false,
    includeVerseNumbers: true,
    includeFirstverseNumbers: true,
    includeFootnotes: false,
    includeFootnoteBody: false,
    includeHeadings: false,
    includeCssLink: false,
    inlineStyles: false,
    includeBookTitles: false,
    includeVerseAnchors: false,
    includeChapterNumbers: false,
    includeSubheadings: false,
    includeAudioLink: false,
    attachAudioLinkTo: "passage",
}

const DEFAULT_SETTINGS: BibleReferenceSettings = {
    esvOrgApiToken: '5bea343abb51ab0434a6e929081ab1c4964feef7',
    passageDirectory: "Bible Passages",
    embeddedPassageDirectory: "Bible Passages (Embedded)",
    footerLinkToChapter: false,
    footerLinkName: "",
    footerTagText: "ESVBiblePassage",
    debugMode: false,

    linkParams: DEFAULT_LINK_SETTINGS,
    embeddedLinkParams: DEFAULT_EMBEDDED_LINK_SETTINGS,
}

const pluginDisplayName = "Bible Reference Plugin";
const bibleRefRegex = new RegExp("(?:\\d+ ?)?[a-z]+ ?\\d+(?:(?::\\d+)?(?: ?- ?(?:\\d+ [a-z]+ )?\\d+(?::\\d+)?)?)?");

export default class BibleReferencePlugin extends Plugin {
    settings: BibleReferenceSettings;

    async onload() {
        console.log('Loading ' + pluginDisplayName);
        await this.loadSettings();
        this.addSettingTab(new SettingsTab(this.app, this));
        this.registerEvent(
            //@ts-ignore
            this.app.workspace.on('hover-link', async (e: any) => {
                await this.handlePassageLinkEvent(e);
            })
        );
    }

    onunload() {
        console.log('unloading ' + pluginDisplayName);
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    /**
     * Pulls down bible passages into a note if a link on-hover event is for a bible reference
     */
    private async handlePassageLinkEvent(e: any) {
        if (e.source !== "preview" && e.source !== "editor") {
            return;
        }
        if (this.settings.debugMode) {
            console.log(e);
        }

        const reference = this.getReference(e);

        // Check if reference matches reference regex
        this.debugLog("Checking potential reference: " + reference);
        if (!bibleRefRegex.test(reference)) {
            this.debugLog("Link text doesnt match bible reference regex: " + reference);
            return;
        }

        const isEmbeddedLink = this.isEmbedded(e);
        const passageFolder = isEmbeddedLink ? this.settings.embeddedPassageDirectory : this.settings.passageDirectory;

        // Create passage folder if not already present
        if (this.app.vault.getAbstractFileByPath(passageFolder) == null) {
            console.log("Creating passage folder " + passageFolder);
            await this.app.vault.createFolder(passageFolder);
        }

        // Check if note for passage already exists, create if not
        const passageNotePath = passageFolder + "/" + reference + ".md";
        this.debugLog("Checking if passage already exists at " + passageNotePath + "...");
        const existing = this.app.vault.getAbstractFileByPath(passageNotePath);
        let canonicalRef;
        if (existing != null) {
            this.debugLog(passageNotePath + " already exists.");
            canonicalRef = existing.name.replace(".md", "");
        } else {
            canonicalRef = await this.createNoteFromReference(reference, passageFolder, isEmbeddedLink)
        }

        if (canonicalRef != null) {
            // Update links within the active note to be canonical form
            const canonicalLinkText = passageFolder + "/" + canonicalRef + "|" + canonicalRef;
            await this.updateActiveNoteLinks(e, canonicalLinkText, isEmbeddedLink);
        }
    }

    /**
     * Returns the link text that would represent a bible reference (if it exists)
     */
    getReference(event: any) {
        if (event.source === "editor") {
            const pipeIndex = event.targetEl.innerHTML.indexOf("|")
            if (pipeIndex != -1) {
                return event.targetEl.innerHTML.substring(pipeIndex + 1)
            } else {
                return event.linktext;
            }
        } else if (event.source === "preview") {
            return event.targetEl.innerText;
        }
    }

    /**
     * Returns true if event is an embedded link, false otherwise
     */
    isEmbedded(event: any): boolean {
        if (event.targetEl.parentElement.childNodes[0].data == "!") {
            return true;
        }
        const firstChild = event.targetEl.childNodes[0].innerHTML;
        return firstChild !== undefined && firstChild.startsWith("!");
    }

    /**
     * Queries ESV.org API for passage data and creates a note to persist the data
     */
    async createNoteFromReference(reference: string, passageFolder: string, isEmbeddedLink: boolean) {
        // Build up url
        this.debugLog("Note for " + reference + " does not exist.  Requesting from ESV.org...");
        const normalizedRef = reference.replace(" ", "+");
        const linkSettings = isEmbeddedLink ? this.settings.embeddedLinkParams : this.settings.linkParams;
        let url = "https://api.esv.org/v3/passage/html/?q=" + normalizedRef;
        url += "&include-passage-references=" + linkSettings.includePassageReferences;
        url += "&include-verse-numbers=" + linkSettings.includeVerseNumbers;
        url += "&include-first-verse-numbers=" + linkSettings.includeFirstverseNumbers;
        url += "&include-footnotes=" + linkSettings.includeFootnotes;
        url += "&include-footnote-body=" + linkSettings.includeFootnoteBody;
        url += "&include-headings=" + linkSettings.includeHeadings;
        url += "&include-css-link=" + linkSettings.includeCssLink;
        url += "&inline-styles=" + linkSettings.inlineStyles;
        url += "&include-book-titles=" + linkSettings.includeBookTitles;
        url += "&include-verse-anchors=" + linkSettings.includeVerseAnchors;
        url += "&include-chapter-numbers=" + linkSettings.includeChapterNumbers;
        url += "&include-subheadings=" + linkSettings.includeSubheadings;
        url += "&include-audio-link=" + linkSettings.includeAudioLink;
        url += "&attach-audio-link-to=" + linkSettings.attachAudioLinkTo;

        this.debugLog("Url: " + url);

        // Get passage data
        const resp = await window.fetch(url, {
            method: 'GET',
            headers: {
                "Authorization": "Token " + this.settings.esvOrgApiToken
            },
        });
        const passageData = await resp.json();

        this.debugLog("Passage Data: " + passageData);

        // TODO - check that auth didnt fail

        // Check that the passage reference is valid
        const canonicalRef = passageData["canonical"];
        if (canonicalRef == null || canonicalRef == "") {
            this.debugLog("Query " + normalizedRef + " is not a valid reference")
            return;
        }

        // Create note with passage data
        const now = Date.now();
        const canonicalPath = passageFolder + "/" + canonicalRef + ".md";
        let passageNoteContent = this.asNoteContent(passageData, reference, isEmbeddedLink);
        await this.app.vault.adapter.write(canonicalPath, passageNoteContent, <DataWriteOptions>{
            ctime: now,
            mtime: now
        });
        console.log("Created file " + canonicalPath);
        return canonicalRef;
    }

    /**
     * Converts esv.org response json into a note string
     */
    asNoteContent(passageJsonData: any, query: string, embedded: boolean): string {
        const canonical = passageJsonData["canonical"];
        let aliases = new Set();
        aliases.add(canonical);
        aliases.add(passageJsonData["query"]);
        aliases.add(query);

        let content = "";

        // add metadata
        content += "---\n";
        content += "aliases: [";
        content += Array.from(aliases).join(", ");
        content += "]\n";
        content += "query_timestamp: " + Date.now() + "\n";
        content += embedded ? "tags: [" + this.settings.footerTagText + "]\n" : "";
        content += "---\n\n";

        // add passage html
        const contentLink = "\n[[" + this.settings.passageDirectory + "/" + canonical + "|" + canonical + "]] ([ESV](http://www.esv.org))"
        content += passageJsonData["passages"]
            .join("\n")
            .replace("<p>(<a href=\"http://www.esv.org\" class=\"copyright\">ESV</a>)</p>", contentLink);

        if (!embedded) {
            content += "\n\n---\n\n";

            // Add full chapter link iff not already a chapter
            if (this.settings.footerLinkToChapter && canonical.contains(":")) {
                const chapter = canonical.split(":")[0];
                content += "Passage from **[[";
                content += chapter;
                content += "]]**\n\n";
            }

            // Add footer link
            if (this.settings.footerLinkName != "") {
                content += "[[" + this.settings.footerLinkName + "]]\n"
            }

            // Add footer tag
            if (this.settings.footerTagText != "") {
                content += "#" + this.settings.footerTagText + "\n"
            }
        }

        return content
    }

    /**
     * Updates links within the active note to be of canonical form
     */
    async updateActiveNoteLinks(e: any, canonicalLinkText: string, isEmbeddedLink: boolean) {
        const currFilePath = this.app.workspace.getActiveFile().path;
        const currNoteContent = await this.app.vault.adapter.read(currFilePath);

        if (isEmbeddedLink || e.source === "editor") {
            let fullExistingLink = e.targetEl.parentElement.innerText;

            // take full link (![[foo|bar]]) and replace text (foo|bar) with canonical text
            const canonicalLink = fullExistingLink.replace(e.targetEl.innerText, canonicalLinkText);

            // Escape link text for regex
            let linkRegex = fullExistingLink.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&');
            linkRegex = isEmbeddedLink ? linkRegex : "(?<!!)" + linkRegex;

            // Replace link text with canonical form
            this.debugLog("Replacing " + linkRegex + " with " + canonicalLink);
            const updatedText = currNoteContent.replaceAll(new RegExp(linkRegex, "g"), canonicalLink);
            await this.app.vault.adapter.write(currFilePath, updatedText, <DataWriteOptions>{});
            this.debugLog("Updated active file with canonical link text");
        } else {
            // Replace link text with canonical form
            const existingLinkRegex = "(?<!!)\\[\\[" + e.targetEl.innerText + "\\]\\]";
            const canonicalLink = "[[" + canonicalLinkText + "]]";
            this.debugLog("Replacing " + existingLinkRegex + " with " + canonicalLink)
            const updatedText = currNoteContent.replaceAll(new RegExp(existingLinkRegex, "g"), canonicalLink);
            await this.app.vault.adapter.write(currFilePath, updatedText, <DataWriteOptions>{});
            this.debugLog("Updated active file with canonical link text");
        }
    }

    debugLog(message: string) {
        if (this.settings.debugMode) {
            console.log("[DEBUG] " + message);
        }
    }
}

class SettingsTab extends PluginSettingTab {
    plugin: BibleReferencePlugin;

    constructor(app: App, plugin: BibleReferencePlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        let {containerEl} = this;

        containerEl.empty();

        containerEl.createEl('h1', {text: pluginDisplayName + ' Settings'});

        new Setting(containerEl)
            .setName('ESV.org API Token')
            .setDesc('Generate an ESV.org API token at https://api.esv.org/account/create-application/')
            .addText(text => text
                .setPlaceholder('Enter your API Token')
                .setValue(this.plugin.settings.esvOrgApiToken)
                .onChange(async (value) => {
                    this.plugin.settings.esvOrgApiToken = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName("Passage Note Directory")
            .setDesc("Folder to put notes containing passage html for normal links from the ESV.org API")
            .addText(c => c
                .setValue(this.plugin.settings.passageDirectory)
                .onChange(async value => {
                    this.plugin.settings.passageDirectory = value;
                    await this.plugin.saveSettings();
                })
            );

        new Setting(containerEl)
            .setName("Embedded Passage Note Directory")
            .setDesc("Folder to put notes containing passage html for embedded links from the ESV.org API")
            .addText(c => c
                .setValue(this.plugin.settings.embeddedPassageDirectory)
                .onChange(async value => {
                    this.plugin.settings.embeddedPassageDirectory = value;
                    await this.plugin.saveSettings();
                })
            );

        this.newBooleanSetting(this.plugin.settings, "Footer Link to Chapter", containerEl, "Include a link to the full chapter at the bottom of a passage note.");

        new Setting(containerEl)
            .setName("Footer Link Text")
            .setDesc("Common link placed at the bottom of passage notes will use this value (can be used to link all passages to a central note).  Empty text will not place link.")
            .addText(c => c
                .setValue(this.plugin.settings.footerLinkName)
                .onChange(async value => {
                    this.plugin.settings.footerLinkName = value;
                    await this.plugin.saveSettings();
                })
            );

        new Setting(containerEl)
            .setName("Tag Text")
            .setDesc("Common tag placed within passage notes will use this value (can be used to link all passages to a central tag).  Empty text will not place tag")
            .addText(c => c
                .setValue(this.plugin.settings.footerTagText)
                .onChange(async value => {
                    this.plugin.settings.footerTagText = value;
                    await this.plugin.saveSettings();
                })
            );

        this.newBooleanSetting(this.plugin.settings, "debugMode", containerEl, "If enabled, debug mode will print extra info to the console.");

        containerEl.createEl("h1", {text: "Link Query Setting"})
        containerEl.createEl("span", {text: "ESV.org query settings for normal links.  Ex: [[1 Cor 1:1]]  "})
        containerEl.createEl("a", {
            href: "https://api.esv.org/docs/passage-html",
            text: "Details at https://api.esv.org/docs/passage-html"
        });
        this.newLinkQuerySettings(this.plugin.settings.linkParams, containerEl);

        containerEl.createEl("h1", {text: "Embedded Link Query Setting"})
        containerEl.createEl("span", {text: "ESV.org query settings for embedded links.  Ex: ![[1 Cor 1:1]]  "})
        containerEl.createEl("a", {
            href: "https://api.esv.org/docs/passage-html",
            text: "Details at https://api.esv.org/docs/passage-html"
        });
        this.newLinkQuerySettings(this.plugin.settings.embeddedLinkParams, containerEl);
    }

    newLinkQuerySettings(paramSettings: EsvApiParams, containerEl: HTMLElement) {
        this.newBooleanSetting(paramSettings, "includePassageReferences", containerEl, "Include the passage reference before the text.");
        this.newBooleanSetting(paramSettings, "includeVerseNumbers", containerEl, "Include verse numbers.");
        this.newBooleanSetting(paramSettings, "includeFirstverseNumbers", containerEl, "Include the verse number for the first verse of a chapter.");
        this.newBooleanSetting(paramSettings, "includeFootnotes", containerEl, "Include callouts to footnotes in the text.");
        this.newBooleanSetting(paramSettings, "includeFootnoteBody", containerEl, "Include footnote bodies below the text. Only works if include-footnotes is also true.");
        this.newBooleanSetting(paramSettings, "includeHeadings", containerEl, "Include section headings. For example, the section heading of Matthew 5 is \"The Sermon on the Mount\".");
        this.newBooleanSetting(paramSettings, "includeCssLink", containerEl, "Include a link tag that provides CSS for the returned text.");
        this.newBooleanSetting(paramSettings, "inlineStyles", containerEl, "Include inline CSS for the returned text.");
        this.newBooleanSetting(paramSettings, "includeBookTitles", containerEl, "Include an h2 containing a book name if the first verse of a book is in the requested text.");
        this.newBooleanSetting(paramSettings, "includeVerseAnchors", containerEl, "Add an anchor tag at every verse and heading boundary containing embedded verse data.");
        this.newBooleanSetting(paramSettings, "includeChapterNumbers", containerEl, "Include a chapter number if the first verse in a chapter is in the requested text.");
        this.newBooleanSetting(paramSettings, "includeSubheadings", containerEl, "Include subheadings. Subheadings are the titles of psalms (e.g., Psalm 73's 'A Maskil of Asaph'), the acrostic divisions in Psalm 119, the speakers in Song of Solomon, and the textual notes that appear in John 7 and Mark 16.");
        this.newBooleanSetting(paramSettings, "includeAudioLink", containerEl, "Include a link to the audio version of the requested passage. The link appears in a small tag in the passage's identifying h2 tag.");

        new Setting(containerEl)
            .setName("attachAudioLinkTo")
            .setDesc("Which feature to attach the audio link to. Must be either passage or heading.")
            .addDropdown(c => c
                .addOption("passage", "passage")
                .addOption("heading", "heading")
                .setValue(paramSettings.attachAudioLinkTo)
                .onChange(async value => {
                    paramSettings.attachAudioLinkTo = value;
                    await this.plugin.saveSettings();
                })
            );
    }

    newBooleanSetting(paramSettings: object, name: string, containerEl: HTMLElement, description: string) {
        new Setting(containerEl)
            .setName(name)
            .setDesc(description)
            .addToggle(c => c
                // @ts-ignore
                .setValue(paramSettings[name])
                .onChange(async value => {
                    // @ts-ignore
                    paramSettings[name] = value;
                    await this.plugin.saveSettings();
                })
            );
    }
}
