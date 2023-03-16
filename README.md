<p align="center">
    <img alt="RoNew" src="assets/logo_dark.png#gh-dark-mode-only" width="300px"></img>
    <img alt="RoNew" src="assets/logo_light.png#gh-light-mode-only" width="300px"></img>
    </p>
<p align="center">
In a single click, join the newest server of any Roblox experience!</p>
</p>

<div align="center">

[![Chrome Extension](https://img.shields.io/chrome-web-store/v/kocjbdahjmgeecieicmoffnjgboechih?label=Chrome%20web%20store&style=for-the-badge&color=4285F4&cacheSeconds=3600&logo=google-chrome&logoColor=white)](https://chrome.google.com/webstore/detail/ronew/kocjbdahjmgeecieicmoffnjgboechih)
[![Firefox Extension](https://img.shields.io/amo/v/RoNew?label=Firefox%20add-ons&logo=firefox-browser&logoColor=white&style=for-the-badge&color=FF7139&cacheSeconds=3600)](https://addons.mozilla.org/addon/ronew/)
[![Video Demo](https://img.shields.io/badge/Video%20Demo-0%3A54-red?style=for-the-badge&logo=youtube&color=green&cacheSeconds=3600)](https://youtu.be/vICtZTxcwFE)

</div>

---

This extension allows you to automatically join the newest server of a Roblox experience, by waiting for the newest server to show up.

# Features

-   Get newest Roblox servers for any game
-   Seamless integration
-   Auto Join
-   Refresh

<details>
<summary>Screenshots</summary>

![Screenshot](assets/screenshots/1.png)

![Screenshot](assets/screenshots/2.png)

![Screenshot](assets/screenshots/3.png)

![Screenshot](assets/screenshots/4.png)

![Screenshot](assets/screenshots/5.png)

</details>
<br>

# Installation

## Through the Chrome Web Store

Simply click the button below, and then click `Add to Chrome`

[![Chrome Extension](https://img.shields.io/chrome-web-store/v/kocjbdahjmgeecieicmoffnjgboechih?label=Chrome%20web%20store&style=for-the-badge&color=4285F4&cacheSeconds=3600&logo=google-chrome&logoColor=white)](https://chrome.google.com/webstore/detail/ronew/kocjbdahjmgeecieicmoffnjgboechih)

## Through Firefox Add-ons

Simply click the button below, and then click `Add to Firefox`

[![Firefox Extension](https://img.shields.io/amo/v/RoNew?label=Firefox%20add-ons&logo=firefox-browser&logoColor=white&style=for-the-badge&color=FF7139&cacheSeconds=3600)](https://addons.mozilla.org/addon/ronew/)

## Manually / For Development

<details>
<summary>Expand</summary>

**This option should only be used if the above option will not work / an update has not been approved on the webstore yet**. Only do the following if you know what you are doing.

<details>
<summary>Chrome Instructions</summary>

1. Download this repo (Code > Download ZIP)
2. Extract the zip, drag the `manifests/chrome.json` file into the `src` folder
3. Rename `chrome.json` to `manifest.json`
4. Go to your [chrome extensions page](chrome://extensions)
5. At the top right, turn on developer mode
6. Click `Load unpacked`
7. Select the `src` folder from the extracted zip
8. Confirm

</details>
<summary>Firefox Instructions</summary>

1. Download this repo (Code > Download ZIP)
2. Extract the zip, drag the `manifests/firefox.json` file into the `src` folder
3. Rename `firefox.json` to `manifest.json`
4. Go to your [firefox addons page](about:debugging#/runtime/this-firefox)
5. Click `Load Temporary Add-on...`
6. Select the `manifest.json` file from the `src` folder from the extracted zip
7. Confirm

</details>
</details>

# Usage

1. Navigate to a roblox game page ([try this one](https://www.roblox.com/games/1689414409))
2. <details>
   <summary>
   If on Firefox, allow permissions (click to expand)
   </summary>

    ![Instructions GIF](assets/firefox_permissions.gif)

    `Extensions` -> `RoNew Settings` -> `Always allow on roblox.com`

       </details>

3. Go to the `Servers` tab
4. You should see a `RoNew` section
5. Click `Load New Servers`
6. Enjoy!

Note that it may take a while on certain games, as Roblox can stop creating new servers periodically.

# Issues

If you encounter any issues, please open an issue:

[![Open an issue](https://img.shields.io/github/issues-raw/ThatTimothy/RoNew?label=Open%20an%20issue&logo=github&style=for-the-badge&cacheSeconds=3600)](https://github.com/ThatTimothy/RoNew/issues/new)

Please include as much detail as possible, such as what you did to get the issue to occur, and what the actual issue is.

# License

See [LICENSE.md](LICENSE.md)
