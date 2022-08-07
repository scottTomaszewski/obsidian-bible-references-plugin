import {App, DataWriteOptions, Plugin, PluginSettingTab, Setting} from 'obsidian';

interface BibleReferenceSettings {
    esvOrgApiToken: string;
    passageDirectory: string;
    footerLinkToChapter: boolean;
    footerLinkName: string;
    footerTagText: string;
    debugMode: boolean;

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
    windowsFix: boolean;
    attachAudioLinkTo: string;
}

const DEFAULT_SETTINGS: BibleReferenceSettings = {
    esvOrgApiToken: '5bea343abb51ab0434a6e929081ab1c4964feef7',
    passageDirectory: "Bible Passages",
    footerLinkToChapter: false,
    footerLinkName: "",
    footerTagText: "ESVBiblePassage",
    debugMode: false,

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
    windowsFix: false,
    attachAudioLinkTo: "passage",
}

const pluginDisplayName = "Bible Reference Plugin";

export default class MyPlugin extends Plugin {
    settings: BibleReferenceSettings;

    debugLog(message: string) {
        if (this.settings.debugMode) {
            console.log("[DEBUG] " + message);
        }
    }

    async onload() {
        const bibleRefRegex = new RegExp("(?:\\d+ ?)?[a-z]+ ?\\d+(?:(?:[:.]\\d+)?(?: ?- ?(?:\\d+ [a-z]+ )?\\d+(?:[:.]\\d+)?)?)?");

        console.log('Loading ' + pluginDisplayName);

        await this.loadSettings();

        this.addSettingTab(new SampleSettingTab(this.app, this));

        this.registerEvent(
            //@ts-ignore
            this.app.workspace.on('hover-link', async (e: any) => {
                if (e.source == "preview" || e.source == "editor") {
                    console.log(e);
                    const reference = e.linktext;
                    const embeddedLink = e.event.fromElement.parentNode.childNodes[0].data == "!";

                    if (embeddedLink) {
                        console.log("EMBEDDED");
                    }

                    // Check the link text against reference regex
                    if (!bibleRefRegex.test(reference)) {
                        // console.log("Link text doesnt match bible reference regex: " + reference);
                        return;
                    }

                    // Create passage folder if not already present
                    const passageFolder = this.settings.passageDirectory;
                    if (this.app.vault.getAbstractFileByPath(passageFolder) == null) {
                        console.log("Creating passage folder " + passageFolder);
                        await this.app.vault.createFolder(passageFolder);
                    }

                    const passageNotePath = passageFolder + "/" + reference + ".md";

                    // Check if note for passage already exists
                    this.debugLog("Looking for " + passageNotePath + "...");
                    const existing = this.app.vault.getAbstractFileByPath(passageNotePath);
                    if (existing != null) {
                        this.debugLog(passageNotePath + " already exists, nothing to do.");
                        return;
                    }

                    // Build up url
                    this.debugLog("Note for " + reference + " does not exist.  Requesting from ESV.org...");
                    const normalizedRef = reference.replace(" ", "+").replace(".", ":");
                    let url = "https://api.esv.org/v3/passage/html/?q=" + normalizedRef;
                    url += "&include-passage-references=" + this.settings.includePassageReferences;
                    url += "&include-verse-numbers=" + this.settings.includeVerseNumbers;
                    url += "&include-first-verse-numbers=" + this.settings.includeFirstverseNumbers;
                    url += "&include-footnotes=" + this.settings.includeFootnotes;
                    url += "&include-footnote-body=" + this.settings.includeFootnoteBody;
                    url += "&include-headings=" + this.settings.includeHeadings;
                    url += "&include-css-link=" + this.settings.includeCssLink;
                    url += "&inline-styles=" + this.settings.inlineStyles;
                    url += "&include-book-titles=" + this.settings.includeBookTitles;
                    url += "&include-verse-anchors=" + this.settings.includeVerseAnchors;
                    url += "&include-chapter-numbers=" + this.settings.includeChapterNumbers;
                    url += "&include-subheadings=" + this.settings.includeSubheadings;
                    url += "&include-audio-link=" + this.settings.includeAudioLink;
                    url += "&attach-audio-link-to=" + this.settings.attachAudioLinkTo;

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
                    const canonicalRef = (this.settings.windowsFix) ? passageData["canonical"].replace(":",".") : passageData["canonical"];
                    if (canonicalRef == null || canonicalRef == "") {
                        this.debugLog("Query " + normalizedRef + " is not a valid reference")
                        return;
                    }

                    // Create note with passage data
                    const now = Date.now();
                    const canonicalPath = passageFolder + "/" + canonicalRef + ".md";
                    await this.app.vault.adapter.write(canonicalPath, this.asNoteContent(passageData, reference), <DataWriteOptions>{
                        ctime: now,
                        mtime: now
                    });
                    console.log("Created file " + canonicalPath);

                    // Replace link text with canonical form
                    const currFilePath = this.app.workspace.getActiveFile().path;
                    const currText = await this.app.vault.adapter.read(currFilePath);
                    const updatedText = currText.replace("[[" + reference + "]]", "[[" + canonicalRef + "]]");
                    await this.app.vault.adapter.write(currFilePath, updatedText, <DataWriteOptions>{mtime: now});
                    this.debugLog("Updated active file with canonical link text");
                }
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

    asNoteContent(passageJsonData: any, query: string) {
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

        // content += "parsed: ";
        // content += passageJsonData["parsed"].toString();
        // content += "\n";

        content += "query_timestamp: " + Date.now() + "\n"

        // This is verbose and duplicative
        // content += "query_response: " + JSON.stringify(passageJsonData) + "\n";

        content += "---\n\n";

        // add passage html
        content += passageJsonData["passages"].join("\n");

        content += "\n\n---\n\n";

        // Add full chapter link iff not already a chapter
        if (this.settings.footerLinkToChapter && canonical.contains(":")) {
            const chapter = canonical.split(":")[0];
            content += "Passage from **[[";
            content += chapter;
            content += "]]**\n\n";
        }

        // Add footer link + tag
        if (this.settings.footerLinkName != "") {
            content += "[[" + this.settings.footerLinkName + "]]\n"
        }
        if (this.settings.footerTagText != "") {
            content += "#" + this.settings.footerTagText + "\n"
        }

        return content
    }
}

class SampleSettingTab extends PluginSettingTab {
    plugin: MyPlugin;

    constructor(app: App, plugin: MyPlugin) {
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
                    this.plugin.debugLog("New ESV.org API Token set.");
                }));

        new Setting(containerEl)
            .setName("Passage Note Directory")
            .setDesc("Folder to put notes containing passage html from the ESV.org API")
            .addText(c => c
                .setValue(this.plugin.settings.passageDirectory)
                .onChange(async value => {
                    this.plugin.settings.passageDirectory = value;
                    await this.plugin.saveSettings();
                    this.plugin.debugLog("New passageDirectory set: " + value);
                })
            );

        this.newBooleanSetting("Footer Link to Chapter", containerEl, "Include a link to the full chapter at the bottom of a passage note.");

        new Setting(containerEl)
            .setName("Footer Link Text")
            .setDesc("Link placed at the bottom of passage notes will use this value.  Empty text will not place link")
            .addText(c => c
                .setValue(this.plugin.settings.footerLinkName)
                .onChange(async value => {
                    this.plugin.settings.footerLinkName = value;
                    await this.plugin.saveSettings();
                    this.plugin.debugLog("New footerLinkName set: " + value);
                })
            );

        new Setting(containerEl)
            .setName("Footer Tag Text")
            .setDesc("Tag placed at the bottom of passage notes will use this value.  Empty text will not place tag")
            .addText(c => c
                .setValue(this.plugin.settings.footerTagText)
                .onChange(async value => {
                    this.plugin.settings.footerTagText = value;
                    await this.plugin.saveSettings();
                    this.plugin.debugLog("New footerTextName set: " + value);
                })
            );

        this.newBooleanSetting("debugMode", containerEl, "If enabled, debug mode will print extra info to the console.");

        containerEl.createEl("h1", {text: "Query Setting"})
        containerEl.createEl("a", {
            href: "https://api.esv.org/docs/passage-html",
            text: "Details at https://api.esv.org/docs/passage-html"
        })

        this.newBooleanSetting("includePassageReferences", containerEl, "Include the passage reference before the text.");
        this.newBooleanSetting("includeVerseNumbers", containerEl, "Include verse numbers.");
        this.newBooleanSetting("includeFirstverseNumbers", containerEl, "Include the verse number for the first verse of a chapter.");
        this.newBooleanSetting("includeFootnotes", containerEl, "Include callouts to footnotes in the text.");
        this.newBooleanSetting("includeFootnoteBody", containerEl, "Include footnote bodies below the text. Only works if include-footnotes is also true.");
        this.newBooleanSetting("includeHeadings", containerEl, "Include section headings. For example, the section heading of Matthew 5 is \"The Sermon on the Mount\".");
        this.newBooleanSetting("includeCssLink", containerEl, "Include a link tag that provides CSS for the returned text.");
        this.newBooleanSetting("inlineStyles", containerEl, "Include inline CSS for the returned text.");
        this.newBooleanSetting("includeBookTitles", containerEl, "Include an h2 containing a book name if the first verse of a book is in the requested text.");
        this.newBooleanSetting("includeVerseAnchors", containerEl, "Add an anchor tag at every verse and heading boundary containing embedded verse data.");
        this.newBooleanSetting("includeChapterNumbers", containerEl, "Include a chapter number if the first verse in a chapter is in the requested text.");
        this.newBooleanSetting("includeSubheadings", containerEl, "Include subheadings. Subheadings are the titles of psalms (e.g., Psalm 73's 'A Maskil of Asaph'), the acrostic divisions in Psalm 119, the speakers in Song of Solomon, and the textual notes that appear in John 7 and Mark 16.");
        this.newBooleanSetting("includeAudioLink", containerEl, "Include a link to the audio version of the requested passage. The link appears in a small tag in the passage's identifying h2 tag.");
        this.newBooleanSetting("windowsFix", containerEl, "Use '.' instead of ':' to separate chapter and verse. This avoids the issue of ':' being invalid in Windows file paths.");

        new Setting(containerEl)
            .setName("attachAudioLinkTo")
            .setDesc("Which feature to attach the audio link to. Must be either passage or heading.")
            .addDropdown(c => c
                .addOption("passage", "passage")
                .addOption("heading", "heading")
                .setValue(this.plugin.settings.attachAudioLinkTo)
                .onChange(async value => {
                    this.plugin.settings.attachAudioLinkTo = value;
                    await this.plugin.saveSettings();
                    this.plugin.debugLog("dropdown setting attachAudioLinkTo updated to " + value);
                })
            );
    }

    newBooleanSetting(name: string, containerEl: HTMLElement, description: string) {
        new Setting(containerEl)
            .setName(name)
            .setDesc(description)
            .addToggle(c => c
                // @ts-ignore
                .setValue(this.plugin.settings[name])
                .onChange(async value => {
                    // @ts-ignore
                    this.plugin.settings[name] = value;
                    await this.plugin.saveSettings();
                    this.plugin.debugLog("Boolean setting " + name + " updated to " + value);
                })
            );
    }
}
