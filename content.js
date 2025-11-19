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

// Observer to watch for settings menu
const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
        if (mutation.addedNodes.length) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType === 1 && node.classList && node.classList.contains('ytp-settings-menu')) {
                    // The menu container appeared. Now watch for panels inside it.
                    // Or maybe the panels are already there.
                    const panels = node.querySelectorAll('.ytp-panel-menu');
                    panels.forEach(injectSpeeds);

                    // Also observe the menu for future panel changes (submenus)
                    new MutationObserver((innerMutations) => {
                        innerMutations.forEach(m => {
                            m.addedNodes.forEach(n => {
                                if (n.nodeType === 1 && n.classList && n.classList.contains('ytp-panel-menu')) {
                                    injectSpeeds(n);
                                }
                                // Sometimes the content of the panel changes
                                if (n.nodeType === 1 && n.querySelectorAll) {
                                    const p = n.querySelector('.ytp-panel-menu');
                                    if (p) injectSpeeds(p);
                                }
                            });
                        });
                    }).observe(node, { childList: true, subtree: true });
                }
            }
        }
    }
});

// Also listen for clicks on the settings button to handle cases where MutationObserver might miss
// or if the menu is already in the DOM but hidden.
document.addEventListener('click', (e) => {
    const btn = e.target.closest('.ytp-settings-button');
    if (btn) {
        log('Settings button clicked, polling for menu...');
        let attempts = 0;
        const poll = setInterval(() => {
            attempts++;
            const menu = document.querySelector('.ytp-settings-menu');
            if (menu) {
                const panel = menu.querySelector('.ytp-panel-menu');
                if (panel) {
                    injectSpeeds(panel);
                    clearInterval(poll);
                }
            }
            if (attempts > 20) clearInterval(poll); // Stop after 2 seconds
        }, 100);
    }
});

// Start observing
function init() {
    const player = document.querySelector('#movie_player') || document.body;
    observer.observe(player, { childList: true, subtree: true });
    log('Initialized observer');
}

// Wait for page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Also listen for navigation events (SPA)
document.addEventListener('yt-navigate-finish', () => {
    log('Navigation finished, re-initializing if needed');
    // Re-attach if observer was lost, though observing body usually persists.
    // But the player element might be replaced.
    init();
});
