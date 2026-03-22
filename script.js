// JavaScript for CoC Helper - Pure Client-Side Version

let gameState = null;
let lastLogLength = 0;

let cultureManualAdjustTimer = null;
let cultureManualAdjustDelta = 0;

function flushCultureManualLog() {
    if (cultureManualAdjustDelta === 0) return;
    const d = cultureManualAdjustDelta;
    cultureManualAdjustDelta = 0;
    cultureManualAdjustTimer = null;
    const sign = d > 0 ? '+' : '';
    addLog(`🎭 Manual culture tokens: ${sign}${d} (total: ${gameState.culture_tokens})`);
    lastLogLength = -1;
    updateLog();
}

function queueCultureManualLog(delta) {
    cultureManualAdjustDelta += delta;
    if (cultureManualAdjustTimer) clearTimeout(cultureManualAdjustTimer);
    cultureManualAdjustTimer = setTimeout(flushCultureManualLog, 2500);
}

// Category culture token bonus positions: category -> list of advancement numbers
const cultureBonusMap = {
    'Agriculture': [],
    'Construction': [4],
    'Maritime': [2],
    'Education': [2],
    'Warfare': [1, 4],
    'Spirituality': [2],
    'Economy': [4],
    'Traditions': [1],
    'Science': [1, 2, 3, 4],
    'Government': []
};

// Building names for each category
const buildingMap = {
    'Agriculture': null,
    'Construction': null,
    'Maritime': 'Port',
    'Education': 'Academy',
    'Warfare': 'Fortress',
    'Spirituality': 'Temple',
    'Economy': 'Market',
    'Traditions': 'Obelisk',
    'Science': 'Observatory',
    'Government': null
};

// Category effects - full description for hover help and roll display (IBO = owner this helper is for)
const CATEGORY_EFFECTS = {
    'Agriculture': 'Wonder Check! With the 3rd advancement, Reveal a Wonder.',
    'Construction': 'Wonder Check! With the 3rd advancement, Reveal a Wonder.',
    'Maritime': 'Each advancement increases "Naval Aggression Range" by 1 (starting with 1).',
    'Education': 'When IBO gets his 3rd and 4th advancements in this category, if IBO can discard an Action Card, he does so to ADVANCE.',
    'Warfare': 'Each advancement increases "Land Aggression Range" by 1 (starting with 1).',
    'Spirituality': 'When IBO gets his 3rd and 4th advancements in this category, if IBO can discard an Action Card, he does so to INFLUENCE CULTURE.',
    'Economy': 'When IBO gets his 3rd and 4th advancements in this category, if IBO can discard an Action Card, he does so to CONSTRUCT.',
    'Traditions': 'For every 2 advancements, IBO gains 1 Culture token during the "Change Government?" phase of the Status Phase.',
    'Science': 'When IBO gets his 3rd and 4th advancements in this category, if IBO can discard an Action Card, he does so to RECRUIT.',
    'Government': 'Wonder Check! When IBO gets his 3rd and 4th advancements in this category, if IBO can discard an Action Card, he does so to perform another ACTION this turn.'
};

// Short text for advancement details box (action card effects)
const ACTION_CARD_SHORT = {
    'Education': '3rd/4th adv. discard an Action Card to ADVANCE',
    'Spirituality': '3rd/4th adv. discard an Action Card to INFLUENCE CULTURE',
    'Economy': '3rd/4th adv. discard an Action Card to CONSTRUCT',
    'Science': '3rd/4th adv. discard an Action Card to RECRUIT',
    'Government': '3rd/4th adv. discard an Action Card to perform another ACTION'
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadState();
    setupEventListeners();
    injectAdvancementHelp();
    restoreCultureTokenToggleState();
    updateUI();
});

// Inject hover-help div with category effect into each advancement item (one-time)
function injectAdvancementHelp() {
    document.querySelectorAll('.advancement-item').forEach(item => {
        const category = item.dataset.category;
        if (!category || item.querySelector('.advancement-help')) return;
        const help = document.createElement('div');
        help.className = 'advancement-help';
        help.textContent = CATEGORY_EFFECTS[category] || '';
        item.appendChild(help);
    });
}

// Restore culture token section toggle state from localStorage
function restoreCultureTokenToggleState() {
    // No longer needed - culture token section removed
}

// Setup Event Listeners
function setupEventListeners() {
    document.getElementById('rollBtn').addEventListener('click', rollAdvancement);
    document.getElementById('clearLogBtn').addEventListener('click', clearLog);
    document.getElementById('resetGameBtn').addEventListener('click', resetGame);
    
    // Inline token buttons (in header)
    document.getElementById('tokenIncBtn').addEventListener('click', incrementCultureTokens);
    document.getElementById('tokenDecBtn').addEventListener('click', decrementCultureTokens);

    // Click on advancement items to manually adjust
    document.querySelectorAll('.advancement-item').forEach(item => {
        item.addEventListener('click', (e) => {
            const category = item.dataset.category;
            if (e.shiftKey) {
                decrementAdvancement(category);
            } else if (e.ctrlKey) {
                resetCategory(category);
            }
        });
    });
}

// Load state from localStorage
function loadState() {
    const saved = localStorage.getItem('cocHelperState');
    
    if (saved) {
        gameState = JSON.parse(saved);
        if (gameState.event_filled === undefined) gameState.event_filled = 3;
    } else {
        // Initialize default state
        gameState = {
            'advancement_slots': {
                'Agriculture': [1],
                'Construction': [1],
                'Maritime': [],
                'Education': [],
                'Warfare': [],
                'Spirituality': [],
                'Economy': [],
                'Traditions': [],
                'Science': [],
                'Government': []
            },
            'scale_position': 0,
            'culture_tokens': 0,
            'event_filled': 3,
            'last_roll': null,
            'current_roll_info': null,
            'log': [
                {
                    'timestamp': new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                    'message': '🎮 Game initialized!',
                    'roll_data': null
                }
            ]
        };
    }
    
    applyCultureBonusStyles();
    updateUI();
}

// Save state to localStorage
function saveState() {
    localStorage.setItem('cocHelperState', JSON.stringify(gameState));
}

// Calculate aggression ranges based on advancements
function calculateAggressionRanges() {
    const navalAdvance = (gameState.advancement_slots['Maritime'] || []).length;
    const landAdvance = (gameState.advancement_slots['Warfare'] || []).length;
    
    return {
        naval: 1 + navalAdvance,
        land: 1 + landAdvance
    };
}

// Update UI based on current state
function updateUI() {
    // Update advancement slots for each category
    Object.entries(gameState.advancement_slots).forEach(([category, slots]) => {
        const elem = document.getElementById(`count-${category}`);
        
        if (elem) {
            // Clear previous squares
            const squareGroup = elem.querySelector('.square-group');
            squareGroup.innerHTML = '';
            
            // Get culture bonus levels for this category
            const bonusLevels = cultureBonusMap[category] || [];
            
            // Get the newly added slot from roll info (if it's for this category)
            const newlyAddedSlot = gameState.current_roll_info?.category === category ? gameState.current_roll_info?.slot : null;
            
            // Add squares for all 4 slots
            for (let slotNum = 1; slotNum <= 4; slotNum++) {
                const square = document.createElement('span');
                const isFilled = slots.includes(slotNum);
                const hasBonus = bonusLevels.includes(slotNum);
                const isNewlyAdded = isFilled && slotNum === newlyAddedSlot;
                
                // Build class name based on state
                let className = 'advancement-square';
                if (isFilled) {
                    className += ' filled';
                } else {
                    className += ' empty';
                }
                if (hasBonus) {
                    className += ' culture-bonus';
                }
                if (isNewlyAdded) {
                    className += ' newly-added';
                }
                
                square.className = className;
                
                // Add title with building info if filled
                if (isFilled && buildingMap[category]) {
                    square.title = `${buildingMap[category]} (Slot ${slotNum})`;
                }
                
                squareGroup.appendChild(square);
            }
            
            // Add building label below squares if category has a building
            let buildingLabel = elem.querySelector('.building-label');
            if (buildingMap[category]) {
                if (!buildingLabel) {
                    buildingLabel = document.createElement('div');
                    buildingLabel.className = 'building-label';
                    elem.appendChild(buildingLabel);
                }
                buildingLabel.textContent = buildingMap[category];
            } else {
                if (buildingLabel) {
                    buildingLabel.remove();
                }
            }
        }
    });

    // Update roll info display
    displayRollInfo(gameState.current_roll_info);

    // Update event tracker squares (event_filled = number of filled squares, 0–3)
    const eventSquares = document.querySelectorAll('#eventTrackerSquares .event-square');
    const filledCount = Math.min(3, Math.max(0, gameState.event_filled !== undefined ? gameState.event_filled : 3));
    eventSquares.forEach((sq, i) => {
        sq.classList.toggle('filled', i < filledCount);
        sq.classList.toggle('empty', i >= filledCount);
    });

    // Update aggression ranges
    updateAggressionRanges();

    // Update culture token display
    updateCultureTokenDisplay();

    // Update total advancements counter (e.g. 2/40)
    const totalAdvancements = Object.values(gameState.advancement_slots || {}).reduce((sum, slots) => sum + (slots && slots.length) || 0, 0);
    const totalEl = document.getElementById('advancementTotalCount');
    if (totalEl) totalEl.textContent = `${totalAdvancements}/40`;

    // Update log
    updateLog();
}

// Roll advancement
function rollAdvancement() {
    const rollIndex = (gameState.roll_index != null ? gameState.roll_index : 0) + 1;
    gameState.roll_index = rollIndex;

    // Event tracker: one square unfilled per roll; when all unfilled, reset and draw Event card
    let eventFilled = gameState.event_filled !== undefined ? gameState.event_filled : 3;
    eventFilled = Math.max(0, eventFilled - 1);
    gameState.event_filled = eventFilled;
    let drawEventCard = false;
    if (eventFilled === 0) {
        gameState.event_filled = 3;
        drawEventCard = true;
        addLog('📇 Draw Event card!', rollIndex);
    }

    // Generate random rolls
    const firstDie = Math.floor(Math.random() * 3) + 1;
    const secondDie = Math.floor(Math.random() * 3) + 1;
    const thirdDie = Math.floor(Math.random() * 3) + 1;
    
    // Determine third value interpretation
    let thirdInterpretation = null;
    if (thirdDie <= 3) {
        thirdInterpretation = 1;
    } else if (thirdDie <= 5) {
        thirdInterpretation = 2;
    } else {
        thirdInterpretation = 3;
    }
    
    // Get category from first and second dice
    const category = getCategoryFromRolls(firstDie, secondDie);
    
    // Log the roll
    let rollMsg = `🎲 Rolled: ${firstDie} (1st) + ${secondDie} (2nd) + ${thirdDie} (3rd → ${thirdInterpretation}) → <strong>${category}</strong>`;
    
    addLog(rollMsg, rollIndex);
    
    const rollInfo = {
        'category': category,
        'old_slots': (gameState['advancement_slots'][category] || []).slice(),
        'building': null,
        'culture_token': false,
        'message': `Advanced in ${category}`,
        'draw_event_card': drawEventCard
    };
    
    // Check if category is already at max (4 slots filled)
    if (category in gameState['advancement_slots']) {
        const currentSlots = gameState['advancement_slots'][category];
        
        if (currentSlots.length >= 4) {
            // Category is full, redirect to Government RECRUIT action
            const govCurrentSlots = gameState['advancement_slots']['Government'] || [];
            const govAvailableSlots = [1, 2, 3, 4].filter(slot => !govCurrentSlots.includes(slot));
            
            if (govAvailableSlots.length > 0) {
                const govNewSlot = govAvailableSlots.includes(1)
                    ? 1
                    : govAvailableSlots[Math.floor(Math.random() * govAvailableSlots.length)];
                gameState['advancement_slots']['Government'].push(govNewSlot);
                gameState['advancement_slots']['Government'].sort((a, b) => a - b);
                
                rollInfo['category'] = 'Government';
                rollInfo['new_slots'] = gameState['advancement_slots']['Government'].slice();
                rollInfo['slot'] = govNewSlot;
                rollInfo['recruit_redirect'] = true;
                rollInfo['recruit_from_category'] = category;
                rollInfo['recruit_slot'] = govNewSlot;
                const govProgress = gameState['advancement_slots']['Government'].length;
                const govEffect = CATEGORY_EFFECTS['Government'] || '';
                rollInfo['wonder_check'] = true;
                if (govProgress >= 3) {
                    rollInfo['message'] = `✓ Wonder Check! ${govEffect}`;
                    addLog(`✓ Wonder Check! <strong>${govEffect}</strong>`, rollIndex);
                } else {
                    rollInfo['message'] = '✓ Wonder Check!';
                    addLog(`✓ Wonder Check!`, rollIndex);
                }
                addLog(`🎯 Rolled <strong>${category}</strong> is full (4/4) — <strong>Government</strong> advancement, slot ${govNewSlot} (${govProgress}/4)`, rollIndex);
            } else {
                rollInfo['category'] = 'Government';
                if (category === 'Government') {
                    rollInfo['government_full_no_advance'] = true;
                    rollInfo['message'] = 'Government advancement is full (4/4). IBO does not advance in Government; this ADVANCE resolves as RECRUIT instead.';
                    addLog('🎖️ <strong>Government</strong> full (4/4) — no Government advancement; this result is <strong>RECRUIT</strong> instead.', rollIndex);
                } else {
                    rollInfo['message'] = '🎖️ RECRUIT action attempted but Government is also full!';
                    addLog('🎖️ ' + category + ' is full! Government RECRUIT also full - no advancement', rollIndex);
                }
            }
            
            rollInfo['draw_event_card'] = drawEventCard;
            gameState['current_roll_info'] = rollInfo;
            saveState();
            updateUI();
            // Apply orange highlight to Government when redirect
            document.querySelectorAll('.advancement-item.last-rolled').forEach(item => item.classList.remove('last-rolled'));
            setTimeout(() => {
                const govElem = document.querySelector('.advancement-item[data-category="Government"]');
                if (govElem) govElem.classList.add('last-rolled');
            }, 50);
            return;
        }
        
        // Get available slots (1-4 that are not yet filled)
        const availableSlots = [1, 2, 3, 4].filter(slot => !currentSlots.includes(slot));
        
        // First advancement in category = slot 1; Government also always takes slot 1 next if still free
        let newSlot;
        let actionDesc = '';
        if (currentSlots.length === 0) {
            newSlot = 1;
            actionDesc = 'First advancement - slot 1';
            rollInfo['message'] = '🎯 First advancement - slot 1 placed';
        } else if (category === 'Government' && availableSlots.includes(1)) {
            newSlot = 1;
            actionDesc = 'Government: slot 1 (first available)';
            rollInfo['message'] = '🎯 Government advancement — slot 1 placed';
        } else {
            newSlot = availableSlots[Math.floor(Math.random() * availableSlots.length)];
            actionDesc = `Randomly selected slot ${newSlot}`;
            rollInfo['message'] = `🎲 Randomly selected slot ${newSlot}`;
        }
        
        // Add the new slot
        gameState['advancement_slots'][category].push(newSlot);
        gameState['advancement_slots'][category].sort((a, b) => a - b);
        rollInfo['new_slots'] = gameState['advancement_slots'][category].slice();
        rollInfo['slot'] = newSlot;
        
        const totalFilled = gameState['advancement_slots'][category].length;
        
        // Maritime/Warfare: show range increased message with new value
        const ranges = calculateAggressionRanges();
        if (category === 'Maritime') {
            rollInfo['range_message'] = `Naval range increased (+1) to total of ${ranges.naval}`;
            addLog(`⛵🗡️ ${rollInfo['range_message']}`, rollIndex);
        } else if (category === 'Warfare') {
            rollInfo['range_message'] = `Land range increased (+1) to total of ${ranges.land}`;
            addLog(`🗡️🥾 ${rollInfo['range_message']}`, rollIndex);
        }
        
        // Check if building should be placed (when first slot is filled)
        if (newSlot === 1 && currentSlots.length === 0) {
            if (buildingMap[category]) {
                rollInfo['building'] = buildingMap[category];
                rollInfo['message'] = `🏗️ Building placed: ${buildingMap[category]}`;
                addLog(`✅ <strong>${category}</strong> Slot ${newSlot} → 🏗️ ${buildingMap[category]} placed (${totalFilled}/4)`, rollIndex);
            }
        } else {
            addLog(`✅ <strong>${category}</strong> Slot ${newSlot} placed (${totalFilled}/4)`, rollIndex);
        }
        
        // Check for culture token: by slot for most categories, or by total count for Traditions ("every 2 advancements" = at 2nd and 4th total)
        const cultureTokenLevels = cultureBonusMap[category] || [];
        const traditionsCultureToken = category === 'Traditions' && (totalFilled === 2 || totalFilled === 4);
        const slotBasedCultureToken = cultureTokenLevels.includes(newSlot);
        
        if (traditionsCultureToken || slotBasedCultureToken) {
            rollInfo['culture_token'] = true;
            rollInfo['message'] = '🎭 +1 Culture Token earned!';
            gameState.culture_tokens = (gameState.culture_tokens || 0) + 1;
            addLog(`🎭 +1 Culture token (${gameState.culture_tokens} total)`, rollIndex);
        }
        
        // Government: Wonder Check on every advance; full rule + action card at 3rd/4th total
        if (category === 'Government') {
            rollInfo['wonder_check'] = true;
            const govEffect = CATEGORY_EFFECTS['Government'] || '';
            if (totalFilled >= 3) {
                rollInfo['message'] = `✓ Wonder Check! ${govEffect}`;
                rollInfo['action_card_effect'] = true;
                rollInfo['action_card_message'] = govEffect;
                addLog(`✓ Wonder Check! <strong>${govEffect}</strong>`, rollIndex);
                addLog(`📋 <strong>${govEffect}</strong>`, rollIndex);
            } else {
                rollInfo['message'] = '✓ Wonder Check!';
                addLog(`✓ Wonder Check!`, rollIndex);
            }
        }

        // 3rd/4th advancement = total count in category — Agriculture & Construction Wonder; other categories action cards
        const isThirdOrFourthTotal = totalFilled === 3 || totalFilled === 4;
        
        if ((category === 'Agriculture' || category === 'Construction') && isThirdOrFourthTotal) {
            rollInfo['wonder_check'] = true;
            rollInfo['wonder_total'] = totalFilled;
            const effect = CATEGORY_EFFECTS[category] || '';
            rollInfo['message'] = totalFilled === 3
                ? `✓ Wonder Check! With the 3rd advancement, Reveal a Wonder.`
                : `✓ Wonder Check!`;
            addLog(`✓ Wonder Check! <strong>${effect}</strong>`, rollIndex);
        }
        
        const actionCardCategories = ['Education', 'Spirituality', 'Economy', 'Science'];
        if (actionCardCategories.includes(category) && isThirdOrFourthTotal) {
            const effect = CATEGORY_EFFECTS[category] || '';
            rollInfo['action_card_effect'] = true;
            rollInfo['action_card_message'] = effect;
            rollInfo['message'] = '';
            addLog(`📋 <strong>${effect}</strong>`, rollIndex);
        }
    }
    
    gameState['current_roll_info'] = rollInfo;
    saveState();
    updateUI();

    // Show building notification only (culture token: light up counter instead)
    if (rollInfo.building) {
        showNotification(`🏗️ Building placed: ${rollInfo.building}`, 'building');
    }
    
    if (rollInfo.culture_token) {
        lightUpCultureCounter();
    }

    // Add last-rolled class to current item (including when redirect to Government)
    const rollCategory = rollInfo.category;
    if (rollCategory) {
        document.querySelectorAll('.advancement-item.last-rolled').forEach(item => {
            item.classList.remove('last-rolled');
        });
        setTimeout(() => {
            const elem = document.querySelector(`.advancement-item[data-category="${rollCategory}"]`);
            if (elem) {
                elem.classList.add('last-rolled');
            }
        }, 50);
    }
}

function lightUpCultureCounter() {
    const badge = document.getElementById('cultureTokenBadge');
    const inner = badge && badge.closest('.culture-token-badge');
    if (inner) {
        inner.classList.add('culture-token-light-up');
        setTimeout(() => inner.classList.remove('culture-token-light-up'), 2000);
    }
}

// Get category from dice rolls
function getCategoryFromRolls(firstVal, secondVal) {
    const categoriesGrid = [
        ['Agriculture', 'Construction', 'Maritime'],      // Row 1 (first_val 1)
        ['Education', 'Warfare', 'Spirituality'],         // Row 2 (first_val 2)
        ['Economy', 'Traditions', 'Science'],             // Row 3 (first_val 3)
        ['Government', 'Agriculture', 'Construction']     // Row 4 (first_val 4)
    ];
    
    const firstIdx = Math.min(firstVal - 1, 3);
    const secondIdx = Math.min(secondVal - 1, 2);
    
    return categoriesGrid[firstIdx][secondIdx];
}

// Decrement advancement (Shift+Click) - not used with slot-based system
// Kept as placeholder for backward compatibility
function decrementAdvancement(category) {
    console.log('Decrement not available in slot-based advancement system');
}

// Reset category (Ctrl+Click)
function resetCategory(category) {
    if (category in gameState['advancement_slots']) {
        const oldSlots = gameState['advancement_slots'][category].slice();
        gameState['advancement_slots'][category] = [];
        addLog(`🔄 ${category} reset from [${oldSlots.join(', ')}] to []`);
        saveState();
        updateUI();
    }
}

// Clear log
function clearLog() {
    gameState['log'] = [];
    saveState();
    updateUI();
}

// Reset entire game
function resetGame() {
    if (confirm('Are you sure you want to reset the entire game? This cannot be undone.')) {
        gameState = {
            'advancement_slots': {
                'Agriculture': [1],
                'Construction': [1],
                'Maritime': [],
                'Education': [],
                'Warfare': [],
                'Spirituality': [],
                'Economy': [],
                'Traditions': [],
                'Science': [],
                'Government': []
            },
            'scale_position': 0,
            'culture_tokens': 0,
            'event_filled': 3,
            'last_roll': null,
            'current_roll_info': null,
            'log': [
                {
                    'timestamp': new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                    'message': '🎮 Game reset!',
                    'roll_data': null
                }
            ]
        };
        saveState();
        updateUI();
    }
}

// Update log display
function updateLog() {
    // Only update if log has changed
    if (gameState.log.length === lastLogLength) {
        return;
    }
    
    lastLogLength = gameState.log.length;
    const logContainer = document.getElementById('logContainer');
    logContainer.innerHTML = '';

    // Reverse log to show latest entries on top
    const reversedLog = [...gameState.log].reverse();
    
    reversedLog.forEach((entry) => {
        const rollGroup = entry.roll_index != null ? entry.roll_index : 0;
        const altClass = rollGroup % 2 === 0 ? ' log-entry-alt-a' : ' log-entry-alt-b';
        const div = document.createElement('div');
        div.className = 'log-entry' + altClass;
        
        const timestamp = document.createElement('span');
        timestamp.className = 'log-timestamp';
        timestamp.textContent = entry.timestamp;
        
        const message = document.createElement('span');
        message.className = 'log-message';
        message.innerHTML = entry.message;
        
        div.appendChild(timestamp);
        div.appendChild(message);
        logContainer.appendChild(div);
    });

    // Auto-scroll to top since newest entries are there
    logContainer.scrollTop = 0;
}

// Add log entry (rollIndex optional: when set, entry is grouped with that roll for alternating row color)
function addLog(message, rollIndex) {
    const timestamp = new Date().toLocaleTimeString('en-US', { 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
    });
    gameState.log.push({
        'timestamp': timestamp,
        'message': message,
        'roll_data': null,
        'roll_index': rollIndex != null ? rollIndex : undefined
    });
    
    if (gameState.log.length > 100) {
        gameState.log.shift();
    }
}

function escapeHtml(s) {
    if (s == null || s === undefined) return '';
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// Display roll information
function displayRollInfo(rollInfo) {
    const infoContent = document.getElementById('rollInfo');
    
    if (!rollInfo || !rollInfo.category) {
        infoContent.innerHTML = '<p class="info-placeholder">Roll to see advancement details...</p>';
        return;
    }

    const category = rollInfo.category;
    const totalSlots = (gameState.advancement_slots[category] || []).length;
    const cultureTotal = gameState.culture_tokens || 0;
    
    let html = `<strong class="roll-info-category">${escapeHtml(category)} (${totalSlots}/4)</strong><br>`;
    
    if (rollInfo.recruit_redirect && rollInfo.recruit_from_category) {
        html += `<span class="effect-text">Rolled <strong>${escapeHtml(rollInfo.recruit_from_category)}</strong> is full (4/4) — place <strong>Government</strong> advancement, slot <strong>${escapeHtml(String(rollInfo.recruit_slot))}</strong>.</span><br>`;
    }
    
    if (rollInfo.government_full_no_advance) {
        html += `<span class="effect-text">Government is full (4/4). IBO does not advance in Government; this ADVANCE resolves as <strong>RECRUIT</strong> instead.</span><br>`;
    }
    
    if (rollInfo.culture_token) {
        html += `<span class="roll-info-culture">+1 <img src="assets/culture-token.png" alt="🎭" class="roll-info-culture-icon" onerror="this.outerHTML='🎭 '" /> (${cultureTotal} current total)</span><br>`;
    }
    
    if (rollInfo.building) {
        html += `🏗️ Building: ${escapeHtml(rollInfo.building)}<br>`;
    }
    
    if (rollInfo.range_message) {
        html += `${escapeHtml(rollInfo.range_message)}<br>`;
    }
    
    if (rollInfo.wonder_check) {
        html += `✓ Wonder Check!<br>`;
        const effectText = (rollInfo.message || '').replace(/^✓ Wonder Check!\s*/i, '').trim();
        if (effectText) {
            html += `<small class="effect-text">${escapeHtml(effectText)}</small>`;
        }
    }
    
    if (rollInfo.action_card_effect) {
        const shortMsg = ACTION_CARD_SHORT[category];
        if (shortMsg) {
            html += `<br><small class="effect-text">📋 ${escapeHtml(shortMsg)}</small>`;
        }
    }
    
    if (rollInfo.draw_event_card) {
        html += `<br><strong class="draw-event-text">📇 Draw Event card</strong>`;
    }
    
    const detailMsg = (rollInfo.message || '').trim();
    if (detailMsg && !rollInfo.wonder_check && !rollInfo.government_full_no_advance && !rollInfo.action_card_effect) {
        html += `<p class="roll-info-detail">${escapeHtml(detailMsg)}</p>`;
    }
    
    infoContent.innerHTML = html;
}

// Show notification (building or culture token)
function showNotification(message, type) {
    // Add a temporary notification that fades out
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #E8DCB8, #b8a878);
        color: #1a1a14;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        font-weight: 600;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        z-index: 1000;
        animation: slideInRight 0.3s ease;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Add animations
const animationStyle = document.createElement('style');
animationStyle.textContent = `
    @keyframes pulse {
        0%, 100% { transform: scale(1); border-color: #b8a878; }
        50% { transform: scale(1.1); border-color: #E8DCB8; }
    }
    
    @keyframes slideInRight {
        from {
            opacity: 0;
            transform: translateX(100px);
        }
        to {
            opacity: 1;
            transform: translateX(0);
        }
    }
    
    @keyframes slideOutRight {
        from {
            opacity: 1;
            transform: translateX(0);
        }
        to {
            opacity: 0;
            transform: translateX(100px);
        }
    }
`;
document.head.appendChild(animationStyle);

// Apply culture bonus styles
function applyCultureBonusStyles() {
    // Culture bonus styling is now applied directly in updateUI()
    // This function is kept for compatibility but does nothing
}

// Update aggression ranges display
function updateAggressionRanges() {
    const ranges = calculateAggressionRanges();
    const aggrDisplay = document.getElementById('aggression-display');
    
    if (aggrDisplay) {
        aggrDisplay.innerHTML = `
            <div class="aggression-item">
                <span class="aggression-label">🗡️🥾 Land Ag_Rng:</span>
                <span class="aggression-value">${ranges.land}</span>
            </div>
            <div class="aggression-item">
                <span class="aggression-label">⛵🗡️ Naval Agr_Rng:</span>
                <span class="aggression-value">${ranges.naval}</span>
            </div>
        `;
    }
}

// Update culture token display
function updateCultureTokenDisplay() {
    const tokenCount = document.getElementById('cultureTokenCount');
    const tokenBadge = document.getElementById('cultureTokenBadge');
    const culture = gameState.culture_tokens || 0;
    
    if (tokenCount) {
        tokenCount.textContent = culture;
    }
    if (tokenBadge) {
        tokenBadge.textContent = culture;
    }
}

// Toggle culture token section visibility

// Increment culture tokens
function incrementCultureTokens() {
    gameState.culture_tokens = (gameState.culture_tokens || 0) + 1;
    queueCultureManualLog(1);
    saveState();
    updateCultureTokenDisplay();
}

// Decrement culture tokens
function decrementCultureTokens() {
    if ((gameState.culture_tokens || 0) > 0) {
        gameState.culture_tokens -= 1;
        queueCultureManualLog(-1);
        saveState();
        updateCultureTokenDisplay();
    }
}
