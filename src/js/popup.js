const GAMES_PAGE_REGEX = /roblox\.com\/games\/(\d*)\//g

const STORAGE_KEY_PLACE_ID = "RONEW_LAST_PLACE_ID"
const STORAGE_KEY_SERVERS = "RONEW_LAST_SERVERS"
const STORAGE_KEY_SERVERS_UPDATE = "RONEW_LAST_SERVERS_UPDATE"
const STORAGE_PLACE_ID_EXPIRE_TIME = 1 * 60 * 1000
const STORAGE_SERVERS_EXPIRE_TIME = 60 * 1000

const RATELIMIT_BACKOFF = 15.0 * 1000
const SERVER_ERROR_BACKOFF = 30.0 * 1000
const BETWEEN_DELAY = 2.5 * 1000
const BETWEEN_FETCHING_ALL = 5.0 * 1000

let tab
let tabPlaceId
let attempts = 1

function logError(error) {
    console.log(`[RoNew]: ${error}`)
}

// Gets the current tab
async function getCurrentTab() {
    const tabs = await chrome.tabs.query({
        active: true,
        lastFocusedWindow: true,
    })

    if (tabs.length <= 0) {
        return
    }

    const tab = tabs[0]

    if (!tab.url) {
        return
    }

    return tab
}

// Load from last storage if recent enough, or attempt to get the current tab's placeId, and set the respective input to it
async function loadPlaceId() {
    let loadedPlaceId

    const lastPlaceIdData = (
        await chrome.storage.session.get(STORAGE_KEY_PLACE_ID)
    )[STORAGE_KEY_PLACE_ID]

    if (lastPlaceIdData) {
        let parsed

        try {
            parsed = JSON.parse(lastPlaceIdData)
        } catch {
            return
        }

        if (Date.now() - parsed.time < STORAGE_PLACE_ID_EXPIRE_TIME) {
            loadedPlaceId = parsed.placeId
        }
    }

    if (!tab) {
        return
    }

    const matches = tab.url.match(GAMES_PAGE_REGEX)

    if (!matches || matches.length <= 0) {
        return
    }

    const tabPlaceId = matches[0].split("/")[2]

    return {
        loadedId: loadedPlaceId,
        tabId: tabPlaceId,
    }
}

function setStatus(status, type) {
    let statusContainer = document.getElementById("status")
    let statusText = statusContainer.querySelector("p")

    statusText.innerText = status

    statusContainer.style.setProperty(
        "--data-height",
        statusText.clientHeight + "px"
    )
    statusContainer.setAttribute("data-visible", true)
    statusContainer.setAttribute("data-type", type)
}

function setStatusDetailed(statusDetailed, type) {
    let statusDetailedContainer = document.getElementById("statusDetailed")
    let statusDetailedText = statusDetailedContainer.querySelector("p")

    if (!statusDetailed || statusDetailed == "") {
        statusDetailedText.innerText = ""
        statusDetailedContainer.setAttribute("data-visible", false)
        return
    }

    statusDetailedText.innerText = statusDetailed

    statusDetailedContainer.style.setProperty(
        "--data-height",
        statusDetailedText.clientHeight + "px"
    )
    statusDetailedContainer.setAttribute("data-visible", true)
}

function setStartOptionDisabled(disabled) {
    if (disabled) {
        document.getElementById("placeId").setAttribute("disabled", "")
        document.getElementById("joinButton").setAttribute("disabled", "")
    } else {
        document.getElementById("placeId").removeAttribute("disabled")
        document.getElementById("joinButton").removeAttribute("disabled")
    }
}

async function getPlaceData(placeId) {
    setStatusDetailed(`Fetching place data for ${placeId}...`)
    const response = await fetch(
        `https://games.roblox.com/v1/games/multiget-place-details?placeIds=${placeId}`
    ).catch(() => {
        // do nothing
    })

    setStatusDetailed(`Fetched place data!`)

    if (!response || response.status != 200) {
        return
    }

    const json = await response.json().catch(() => {
        // do nothing
    })

    if (!json) {
        return
    }

    return json[0]
}

function storePlaceId(placeId) {
    return chrome.storage.session.set({
        [STORAGE_KEY_PLACE_ID]: JSON.stringify({
            time: Date.now(),
            placeId: placeId,
        }),
    })
}

async function getStoredServers(placeId) {
    const updateData = await chrome.storage.session.get(
        STORAGE_KEY_SERVERS_UPDATE
    )

    if (!updateData) {
        return
    }

    const update = updateData[STORAGE_KEY_SERVERS_UPDATE]

    let parsedUpdate
    try {
        parsedUpdate = JSON.parse(update)
    } catch (_) {
        return
    }

    if (Date.now() - parsedUpdate.time > STORAGE_SERVERS_EXPIRE_TIME) {
        return
    }

    const storedServersData = await chrome.storage.session.get(
        STORAGE_KEY_SERVERS
    )

    if (!storedServersData) {
        return
    }

    const storedServers = storedServersData[STORAGE_KEY_SERVERS]

    let parsedStoredServers
    try {
        parsedStoredServers = JSON.parse(storedServers)
    } catch (_) {
        return
    }

    if (parsedStoredServers.placeId != placeId) {
        return
    }

    attempts = parsedUpdate.attempts

    const servers = new Set()

    for (const value of parsedStoredServers.servers) {
        servers.add(value)
    }

    return servers
}

async function storeServers(placeId, toStore) {
    const servers = []

    for (const value of toStore) {
        servers.push(value)
    }

    const data = { placeId: placeId, servers: servers }

    await chrome.storage.session.set({
        [STORAGE_KEY_SERVERS]: JSON.stringify(data),
    })
}

function storeServersUpdate() {
    const update = {
        time: Date.now(),
        attempts: attempts,
    }

    return chrome.storage.session.set({
        [STORAGE_KEY_SERVERS_UPDATE]: JSON.stringify(update),
    })
}

function sleepPromise(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms)
    })
}

function formatNumberToTenths(n) {
    nString = (Math.round(n * 10) / 10).toString(10)

    if (!nString.includes(".")) {
        nString += ".0"
    }

    return nString
}

async function sleepWithDetail(ms, prefix, postfix) {
    let start = Date.now()
    while (true) {
        left = ms - (Date.now() - start)

        if (left > 0) {
            setStatusDetailed(
                `${prefix}${formatNumberToTenths(left / 1000)}s${postfix}`
            )
        } else {
            break
        }

        await sleepPromise(Math.min(left, 100))
    }
}

function getServers(placeId, cursor) {
    return new Promise(async (resolve, reject) => {
        // 0 = public servers
        // sort order 1 = lowest first
        // exclude full games = false makes sure we get all servers
        // limit 100 = 100 per page
        const url = `https://games.roblox.com/v1/games/${placeId}/servers/0?sortOrder=1&excludeFullGames=false&limit=100${
            cursor ? `&cursor=${cursor}` : ""
        }`

        const response = await fetch(url)

        let ratelimited = response.status == 429
        let serverError = response.status >= 500 && response.status < 600

        if (ratelimited || serverError) {
            let wait = 0

            if (ratelimited) {
                wait = RATELIMIT_BACKOFF
            } else if (serverError) {
                wait = SERVER_ERROR_BACKOFF
            }

            await sleepWithDetail(wait, "Ratelimited, waiting... (", " left)")

            return getServers(placeId, cursor).then(resolve).catch(reject)
        }

        if (response.status != 200) {
            return reject("Error occurred")
        }

        const json = await response.json().catch(reject)

        resolve(json)
    })
}

function fetchAllServers(placeId) {
    return new Promise(async (resolve, reject) => {
        const seen = new Set()

        let i = 1
        let cursor

        while (true) {
            setStatusDetailed(`Fetching server page ${i}...`)
            const response = await getServers(placeId, cursor).catch(reject)

            if (!response) {
                return
            }

            for (const server of response.data) {
                seen.add(server.id)
            }

            let nextCursor = response.nextPageCursor

            if (!nextCursor) {
                setStatusDetailed(`Finished getting all servers!`)
                break
            }

            cursor = nextCursor

            await sleepWithDetail(
                BETWEEN_DELAY,
                `Got server page ${i}, retrieving next in `,
                `...`
            )
            i += 1
        }

        resolve(seen)
    })
}

async function fetchAllServersMulti(placeId) {
    const allServers = new Set()

    for (let i = 1; i <= 3; i++) {
        setStatus(`Fetching all servers... (${i}/3)`)
        let servers = await fetchAllServers(placeId)

        if (!servers) {
            return
        }

        for (let item of servers) {
            allServers.add(item)
        }

        if (i < 3) {
            await sleepWithDetail(
                BETWEEN_FETCHING_ALL,
                `Finished fetch ${i}, starting next in `,
                "..."
            )
        } else {
            setStatusDetailed("Finished fetching all servers!")
        }
    }

    return allServers
}

function findNewestServerId(placeId, servers) {
    return new Promise(async (resolve, reject) => {
        while (true) {
            setStatusDetailed(`Attempting... (${attempts})`)
            await storeServersUpdate()
            const toCheck = await getServers(placeId).catch(reject)

            if (!toCheck) {
                return
            }

            for (const possible of toCheck.data) {
                const id = possible.id

                if (servers.has(id)) {
                    continue
                }

                return resolve(id)
            }

            await sleepWithDetail(
                BETWEEN_DELAY,
                `No results, retrying in `,
                `... (${attempts})`
            )

            attempts += 1
        }
    })
}

async function injectJoinScript(placeId, serverId) {
    if (!tab) {
        return false
    }

    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        args: [placeId, serverId],
        func: (placeId, serverId) => {
            document.body.setAttribute("data-ronew-placeid", placeId)
            document.body.setAttribute("data-ronew-serverid", serverId)

            const injected = document.createElement("script")
            injected.src = chrome.runtime.getURL("js/injectedJoinScript.js")
            document.body.appendChild(injected)

            setTimeout(() => {
                document.body.removeChild(injected)
            }, 1000)
        },
    })

    return true
}

async function joinNewest() {
    attempts = 1

    setStartOptionDisabled(true)
    setStatus("Please wait...")

    let placeId
    try {
        placeId = parseInt(document.getElementById("placeId").value, 10)
    } catch (e) {
        // do nothing
    }

    if (!placeId || isNaN(placeId)) {
        setStartOptionDisabled(false)
        setStatus("Invalid place id!", "error")
        return
    }

    setStatus("Fetching place data...")

    let placeData = await getPlaceData(placeId)

    if (!placeData) {
        setStartOptionDisabled(false)
        setStatus("Place does not exist!", "error")
        setStatusDetailed(false)
        return
    }

    await storePlaceId(placeId)

    let allServers = await getStoredServers(placeId)

    if (!allServers) {
        allServers = await fetchAllServersMulti(placeId).catch(logError)
    }

    if (!allServers) {
        setStartOptionDisabled(false)
        setStatus("Failed to fetch servers!", "error")
        setStatusDetailed(false)
    }

    await storeServers(placeId, allServers)
    await storeServersUpdate()

    setStatus("Waiting for new server...")
    let id = await findNewestServerId(placeId, allServers).catch(logError)
    if (!id) {
        setStartOptionDisabled(false)
        setStatus("Failed to find new server!", "error")
        setStatusDetailed(false)
        return
    }

    allServers.add(id)

    storeServers(placeId, allServers)
    storeServersUpdate()

    setStatus("Injecting join script...")

    let success = injectJoinScript(placeId, id)

    if (success) {
        setStartOptionDisabled(false)
        setStatus("Joining...", "success")
        setStatusDetailed(false)
    } else {
        setStartOptionDisabled(false)
        setStatus("Failed to inject join script!", "error")
        setStatusDetailed(false)
        return
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    // Setup
    tab = await getCurrentTab()

    const ids = await loadPlaceId()

    if (ids) {
        tabPlaceId = ids.tabId
        document.getElementById("placeId").value =
            ids.loadedId || ids.tabId || ""
    }

    // Events
    document.getElementById("joinButton").addEventListener("click", joinNewest)
})
