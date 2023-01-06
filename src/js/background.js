// When the extension is installed or upgraded ...
chrome.runtime.onInstalled.addListener(function () {
    // Disable page actions be default
    chrome.action.disable()

    // Clear all rules to ensure only our expected rules are set
    chrome.declarativeContent.onPageChanged.removeRules(undefined, () => {
        // Declare a rule to enable the action on example.com pages
        let exampleRule = {
            conditions: [
                new chrome.declarativeContent.PageStateMatcher({
                    pageUrl: { urlMatches: "https://www.roblox.com/*" },
                }),
            ],
            actions: [new chrome.declarativeContent.ShowAction()],
        }

        // Finally, apply our new array of rules
        let rules = [exampleRule]
        chrome.declarativeContent.onPageChanged.addRules(rules)
    })
})
