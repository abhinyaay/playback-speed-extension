// YouTube Speed Controller Content Script

const SPEEDS = [2.5, 3, 3.5, 4];

function log(msg) {
    console.log(`[YT Speed]: ${msg}`);
}

function getVideo() {
    return document.querySelector('video');
}

function setSpeed(speed) {
    const video = getVideo();
    if (video) {
        video.playbackRate = speed;
        log(`Set speed to ${speed}x`);

        // Update the speed label in the settings menu if possible, 
        // but usually YouTube handles this by re-rendering the menu.
        // We might need to force update the label or just rely on the video rate.

        // Also try to update the "Speed" label in the main settings panel if visible
        const speedLabel = document.querySelector('.ytp-menu-label-secondary');
        if (speedLabel) {
            // This is tricky because there are multiple labels. 
            // We'll leave the visual label update for now and focus on functionality.
        }
    }
}

// Function to create a menu item element
function createMenuItem(speed, originalItem) {
    const newItem = originalItem.cloneNode(true);

    // Update text
    const label = newItem.querySelector('.ytp-menuitem-label');
    if (label) {
        label.textContent = speed + 'x';
    }

    // Update aria-label if present
    newItem.setAttribute('aria-label', speed + 'x');

    // Remove checked state initially
    newItem.setAttribute('aria-checked', 'false');

    // Click handler
    newItem.addEventListener('click', (e) => {
        // Prevent default YouTube behavior if necessary, though cloning might carry over some listeners we don't want?
        // Cloning a node usually does NOT copy event listeners added via addEventListener.
        // But it might copy inline handlers (not used much in modern YT).

        // We need to handle the selection visual state.
        // YouTube re-renders this menu often, so our manual class manipulation might be overwritten.
        // But setting the playback rate is the most important part.
        setSpeed(speed);

        // Close the menu (simulate click on background or just let user close it)
        // Usually clicking an item closes the menu.
        // We can try to find the close button or just hide the menu.
        // For now, let's just set the speed.

        // Visual feedback: select this item, deselect others
        const siblings = newItem.parentNode.children;
        for (let sib of siblings) {
            sib.setAttribute('aria-checked', 'false');
        }
        newItem.setAttribute('aria-checked', 'true');

        // Force the video to keep this speed (sometimes YT resets it)
        // We can use an interval or event listener to enforce it if needed.
    });

    return newItem;
}

function injectSpeeds(menuPanel) {
    // Check if this is the speed menu.
    // The speed menu usually contains items like "0.25", "0.5", "Normal", "1.25", etc.
    const items = menuPanel.querySelectorAll('.ytp-menuitem');
    if (items.length === 0) return;

    let isSpeedMenu = false;
    let normalItem = null;

    // We need to be very specific to avoid the main menu.
    // The main menu has "Playback speed" which might contain "Normal" in its label.
    // The actual speed menu has items that are JUST numbers or "Normal".
    // Let's look for "0.25" or "0.75" which are unique to the speed menu.
    let hasLowSpeed = false;
    let hasHighSpeed = false;

    for (let item of items) {
        const text = item.textContent;
        if (text.includes('0.25') || text.includes('0.5') || text.includes('0.75')) {
            hasLowSpeed = true;
        }
        if (text.includes('1.25') || text.includes('1.5') || text.includes('1.75')) {
            hasHighSpeed = true;
        }
        if (text === 'Normal' || text.includes('Normal')) {
            normalItem = item;
        }
    }

    // It's the speed menu if it has the standard speed options
    if (hasLowSpeed && hasHighSpeed) {
        isSpeedMenu = true;
    }

    if (!isSpeedMenu) return;

    // Check if we already injected
    if (menuPanel.querySelector('[data-yt-speed-extension]')) return;

    log('Found speed menu, injecting options...');

    // Find the container to append to
    // We will append after the last item
    const lastItem = items[items.length - 1];

    SPEEDS.forEach(speed => {
        // Use normalItem as template if available, otherwise lastItem
        const template = normalItem || lastItem;
        const newItem = createMenuItem(speed, template);
        newItem.setAttribute('data-yt-speed-extension', 'true');

        // Insert after the last item
        if (lastItem && lastItem.parentNode) {
            lastItem.parentNode.appendChild(newItem);
        } else {
            menuPanel.appendChild(newItem);
        }
    });
}

// Global observer to handle all dynamic updates
const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
        // Check added nodes for the settings menu or panels
        if (mutation.addedNodes.length) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType === 1) {
                    // If the menu itself is added
                    if (node.classList && node.classList.contains('ytp-settings-menu')) {
                        handleMenu(node);
                    }
                    // If a panel is added inside the menu (submenu transition)
                    if (node.classList && node.classList.contains('ytp-panel-menu')) {
                        injectSpeeds(node);
                    }
                    // If menu items are added (lazy load or refresh)
                    if (node.classList && node.classList.contains('ytp-menuitem')) {
                        const panel = node.closest('.ytp-panel-menu');
                        if (panel) injectSpeeds(panel);
                    }
                    // Check children just in case (e.g. a container of items was added)
                    if (node.querySelectorAll) {
                        const menus = node.querySelectorAll('.ytp-settings-menu');
                        menus.forEach(handleMenu);

                        const panels = node.querySelectorAll('.ytp-panel-menu');
                        panels.forEach(injectSpeeds);
                    }
                }
            }
        }
    }
});

function handleMenu(menuNode) {
    // When menu appears, check its current panels
    const panels = menuNode.querySelectorAll('.ytp-panel-menu');
    panels.forEach(injectSpeeds);

    // And observe it for future changes (submenu transitions)
    // We use a WeakMap or set a flag to avoid double observing if possible, 
    // but MutationObserver on the same node with same config is usually safe (deduplicated) or harmless if careful.
    // However, to be safe, let's just rely on the global observer if it covers the subtree.
    // If the global observer is on document.body with subtree:true, it will catch changes inside the menu too!
    // So we might not need a nested observer if the main one is robust enough.
}

// Robust click listener for the settings button
document.addEventListener('click', (e) => {
    const btn = e.target.closest('.ytp-settings-button');
    if (btn) {
        log('Settings button clicked, monitoring for speed menu...');
        // Poll for a bit to catch the menu opening and subsequent interactions
        let attempts = 0;
        const poll = setInterval(() => {
            attempts++;
            // Try to find any open menu panels
            const panels = document.querySelectorAll('.ytp-panel-menu');
            panels.forEach(injectSpeeds);

            // If we found the speed menu and injected, we could stop, but the user might switch back and forth.
            // So let's just keep polling for a short while (e.g., 5 seconds) to cover the interaction.
            if (attempts > 50) clearInterval(poll);
        }, 100);
    }
});

function init() {
    // Observe the entire body to catch everything, including SPA navigations and player replacements
    observer.observe(document.body, { childList: true, subtree: true });
    log('Initialized global observer');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

