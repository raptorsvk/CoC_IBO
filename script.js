// JavaScript for CoC Helper - Pure Client-Side Version

let gameState = null;
let lastLogLength = 0;

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

// Category effects data - shown on Wonder Check or special rules
const CATEGORY_EFFECTS = {
    'Agriculture': 'Wonder Check! Also... with the 3rd advancement, IBD reveals a Wonder.',
    'Construction': 'Wonder Check! Also... with the 3rd advancement, IBD reveals a Wonder.',
    'Maritime': 'Each advancement increases "Naval Aggression Range" by 1.',
    'Education': 'When IBD gets his 3rd and 4th advancements in this category, if IBD can discard an Action Card, he does so to ADVANCE.',
    'Warfare': 'Each advancement increases "Land Aggression Range" by 1.',
    'Spirituality': 'When IBD gets his 3rd and 4th advancements in this category, if IBD can discard an Action Card, he does so to INFLUENCE CULTURE.',
    'Economy': 'When IBD gets his 3rd and 4th advancements in this category, if IBD can discard an Action Card, he does so to CONSTRUCT.',
    'Traditions': 'For every 2 advancements, IBD gains 1 Culture Token during the "Change Government?" phase of the Status Phase.',
    'Science': 'When IBD gets his 3rd and 4th advancements in this category, if IBD can discard an Action Card, he does so to RECRUIT.',
    'Government': 'Wonder Check! Also... when gets his 3rd and 4th advancements in this category, if IBD can discard an Action Card, he does so to perform another ACTION this turn.'
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadState();
    setupEventListeners();
    restoreCultureTokenToggleState();
    updateUI();
});

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

    // Update aggression ranges
    updateAggressionRanges();

    // Update culture token display
    updateCultureTokenDisplay();

    // Update log
    updateLog();
}

// Roll advancement
function rollAdvancement() {
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
    
    addLog(rollMsg);
    
    const rollInfo = {
        'category': category,
        'old_slots': (gameState['advancement_slots'][category] || []).slice(),
        'building': null,
        'culture_token': false,
        'message': `Advanced in ${category}`
    };
    
    // Check if category is already at max (4 slots filled)
    if (category in gameState['advancement_slots']) {
        const currentSlots = gameState['advancement_slots'][category];
        
        if (currentSlots.length >= 4) {
            // Category is full, redirect to Government RECRUIT action
            const govCurrentSlots = gameState['advancement_slots']['Government'] || [];
            const govAvailableSlots = [1, 2, 3, 4].filter(slot => !govCurrentSlots.includes(slot));
            
            if (govAvailableSlots.length > 0) {
                const govNewSlot = govAvailableSlots[Math.floor(Math.random() * govAvailableSlots.length)];
                gameState['advancement_slots']['Government'].push(govNewSlot);
                gameState['advancement_slots']['Government'].sort((a, b) => a - b);
                
                rollInfo['category'] = 'Government';
                rollInfo['new_slots'] = gameState['advancement_slots']['Government'].slice();
                rollInfo['slot'] = govNewSlot;
                rollInfo['message'] = `🎖️ RECRUIT action! Slot ${govNewSlot} filled in Government`;
                const govProgress = gameState['advancement_slots']['Government'].length;
                addLog(`🎖️ <strong>${category}</strong> is full! → RECRUIT action: <strong>Government</strong> Slot ${govNewSlot} (${govProgress}/4)`);
            } else {
                rollInfo['category'] = 'Government';
                rollInfo['message'] = '🎖️ RECRUIT action attempted but Government is also full!';
                addLog('🎖️ ' + category + ' is full! Government RECRUIT also full - no advancement');
            }
            
            gameState['current_roll_info'] = rollInfo;
            saveState();
            updateUI();
            return;
        }
        
        // Get available slots (1-4 that are not yet filled)
        const availableSlots = [1, 2, 3, 4].filter(slot => !currentSlots.includes(slot));
        
        // If first advancement in this category, must use slot 1
        let newSlot;
        let actionDesc = '';
        if (currentSlots.length === 0) {
            newSlot = 1;
            actionDesc = 'First advancement - slot 1';
            rollInfo['message'] = '🎯 First advancement - slot 1 placed';
        } else {
            // Randomly choose from available slots
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
        
        // Check if building should be placed (when first slot is filled)
        if (newSlot === 1 && currentSlots.length === 0) {
            if (buildingMap[category]) {
                rollInfo['building'] = buildingMap[category];
                rollInfo['message'] = `🏗️ Building placed: ${buildingMap[category]}`;
                addLog(`✅ <strong>${category}</strong> Slot ${newSlot} → 🏗️ ${buildingMap[category]} placed (${totalFilled}/4)`);
            }
        } else {
            addLog(`✅ <strong>${category}</strong> Slot ${newSlot} placed (${totalFilled}/4)`);
        }
        
        // Check for culture token (at specific advancement levels for that category)
        const cultureTokenLevels = cultureBonusMap[category] || [];
        
        if (cultureTokenLevels.includes(newSlot)) {
            rollInfo['culture_token'] = true;
            rollInfo['message'] = '🎭 +1 Culture Token earned!';
            // Auto-increment culture token counter
            gameState.culture_tokens = (gameState.culture_tokens || 0) + 1;
            addLog(`🎭 Culture Token earned! (Total: ${gameState.culture_tokens})`);
        }
        
        // Check for Wonder Check (trigger when slot 3 or 4 is filled)
        // Agriculture, Construction, and Government trigger Wonder Check
        const wonderCheckCategories = ['Agriculture', 'Construction', 'Government'];
        
        if (wonderCheckCategories.includes(category) && [3, 4].includes(newSlot)) {
            rollInfo['wonder_check'] = true;
            const effect = CATEGORY_EFFECTS[category] || '';
            rollInfo['message'] = `✓ Wonder Check! ${effect}`;
            addLog(`✓ Wonder Check! <strong>${effect}</strong>`);
        }
    }
    
    gameState['current_roll_info'] = rollInfo;
    saveState();
    updateUI();

    // Show building or culture token notification
    if (rollInfo.building) {
        showNotification(`🏗️ Building placed: ${rollInfo.building}`, 'building');
    }
    
    if (rollInfo.culture_token) {
        showNotification('🎭 +1 Culture Token earned!', 'culture');
    }

    // Add last-rolled class to current item
    const rollCategory = rollInfo.category;
    if (rollCategory) {
        document.querySelectorAll('.advancement-item.last-rolled').forEach(item => {
            item.classList.remove('last-rolled');
        });
        
        setTimeout(() => {
            const elem = document.querySelector(`[data-category="${rollCategory}"]`);
            if (elem) {
                elem.classList.add('last-rolled');
            }
        }, 50);
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
    
    reversedLog.forEach(entry => {
        const div = document.createElement('div');
        div.className = 'log-entry';
        
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

// Add log entry
function addLog(message) {
    const timestamp = new Date().toLocaleTimeString('en-US', { 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
    });
    gameState.log.push({
        'timestamp': timestamp,
        'message': message,
        'roll_data': null
    });
    
    if (gameState.log.length > 100) {
        gameState.log.shift();
    }
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
    
    let html = `<strong>${category}</strong><br>`;
    html += `📊 Progress: ${totalSlots}/4 slots filled<br>`;
    
    if (rollInfo.building) {
        html += `🏗️ Building: ${rollInfo.building}<br>`;
    }
    
    if (rollInfo.culture_token) {
        html += `🎭 Culture Token earned!<br>`;
    }
    
    if (rollInfo.wonder_check) {
        html += `✓ Wonder Check!<br>`;
        // Add the special effects message from the backend
        if (rollInfo.message && rollInfo.message.includes('✓ Wonder Check!')) {
            const effectText = rollInfo.message.replace('✓ Wonder Check! ', '');
            if (effectText) {
                html += `<small style="color: #a855f7;">${effectText}</small>`;
            }
        }
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
        background: linear-gradient(135deg, #a855f7, #7c3aed);
        color: white;
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
        0%, 100% { transform: scale(1); border-color: #7c3aed; }
        50% { transform: scale(1.1); border-color: #a855f7; }
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
                <span class="aggression-label">⚔️ Land Range:</span>
                <span class="aggression-value">${ranges.land}</span>
            </div>
            <div class="aggression-item">
                <span class="aggression-label">🚢 Naval Range:</span>
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
    addLog(`🎭 +1 Culture Token (Total: ${gameState.culture_tokens})`);
    saveState();
    updateCultureTokenDisplay();
}

// Decrement culture tokens
function decrementCultureTokens() {
    if ((gameState.culture_tokens || 0) > 0) {
        gameState.culture_tokens -= 1;
        addLog(`🎭 -1 Culture Token (Total: ${gameState.culture_tokens})`);
        saveState();
        updateCultureTokenDisplay();
    }
}
