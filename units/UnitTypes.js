// All commands available to every unit type
const ALL_COMMANDS = [
  'charge', 'guard-position', 'hold-the-line', 'ordered-retreat',
  'formation-advance', 'screen', 'rally', 'scatter', 'skirmish',
  'overwatch', 'suppressive-fire', 'ambush', 'feint', 'patrol',
  'cover-team', 'envelop', 'breach', 'attack-along-path', 'encircle'
]

// Unit type definitions — stats, icons
export const UNIT_TYPES = {
  'foot-soldier': {
    label: 'Foot Soldiers',
    icon: '⚔️',
    hp: 3, ap: 3, move: 2, attackRange: 1, maxAttackRange: 1, attackValue: 2, defense: 0,
    attackSpeed: 1.5,   // seconds between attacks
    color: '#8b9467',
    commands: ALL_COMMANDS
  },
  'archer': {
    label: 'Archers',
    icon: '🏹',
    hp: 2, ap: 3, move: 2, attackRange: 2, maxAttackRange: 3, attackValue: 2, defense: 0,
    attackSpeed: 1.25,  // ranged (doubled rate)
    color: '#7a9e7e',
    commands: ALL_COMMANDS
  },
  'shield-bearer': {
    label: 'Shield Bearers',
    icon: '🛡️',
    hp: 4, ap: 2, move: 1, attackRange: 1, maxAttackRange: 1, attackValue: 1, defense: 2,
    attackSpeed: 2.0,   // deliberate, defensive
    color: '#7a7a8c',
    commands: ALL_COMMANDS
  },
  'swordsman': {
    label: 'Swordsmen',
    icon: '🗡️',
    hp: 3, ap: 3, move: 2, attackRange: 1, maxAttackRange: 1, attackValue: 3, defense: 0,
    attackSpeed: 1.2,   // fast aggressive melee
    color: '#9e7a7a',
    commands: ALL_COMMANDS
  },
  'knight': {
    label: 'Knights',
    icon: '🐎',
    hp: 4, ap: 4, move: 3, attackRange: 1, maxAttackRange: 1, attackValue: 3, defense: 1,
    attackSpeed: 2.0,   // powerful but deliberate
    color: '#9e8f5a',
    hillPenalty: true,
    commands: ALL_COMMANDS
  }
}

export const COMMAND_DEFS = {
  'guard-position': { label: 'Guard', desc: 'Hold hex, auto-attack entering enemies', ap: 1 },
  'patrol': { label: 'Patrol', desc: 'Move along defined path', ap: 1 },
  'cover-team': { label: 'Cover Team', desc: 'Follow and shield a target team', ap: 1 },
  'ambush': { label: 'Ambush', desc: 'Hide, auto-attack first enemy in range', ap: 1 },
  'overwatch': { label: 'Overwatch', desc: 'Hold fire, attack first enemy entering zone', ap: 1 },
  'suppressive-fire': { label: 'Suppress', desc: 'Pin enemy — reduce their AP by 1', ap: 1 },
  'charge': { label: 'Charge', desc: 'Tap destination — +2 dmg, exposed next round', ap: 1 },
  'skirmish': { label: 'Skirmish', desc: 'Attack then retreat 1 hex', ap: 1 },
  'hold-the-line': { label: 'Hold', desc: '+1 defense, cannot advance', ap: 1 },
  'screen': { label: 'Screen', desc: 'Interpose for a retreating team', ap: 1 },
  'rally': { label: 'Rally', desc: 'Boost adjacent teams defense +1', ap: 1 },
  'feint': { label: 'Feint', desc: 'Advance to bait enemy repositioning', ap: 1 },
  'ordered-retreat': { label: 'Retreat', desc: 'Fall back toward own side', ap: 1 },
  'scatter': { label: 'Scatter', desc: 'Dispersed retreat in all directions', ap: 1 },
  'attack-along-path': { label: 'Assault Path', desc: 'Move and strike along an axis', ap: 1 },
  'envelop': { label: 'Envelop', desc: 'Flank target with another team', ap: 1 },
  'breach': { label: 'Breach', desc: '+2 vs Shield units, push through', ap: 1 },
  'formation-advance': { label: 'Formation', desc: 'Teams advance in formation', ap: 1 },
  'encircle': { label: 'Encircle', desc: 'Spread to surround target team', ap: 1 },
}

// Which commands are available as EMERGENCY commands during resolution
export const EMERGENCY_COMMANDS = [
  'ordered-retreat', 'hold-the-line', 'guard-position', 'screen', 'scatter', 'charge'
]

export function getUnitType(type) {
  return UNIT_TYPES[type] || UNIT_TYPES['foot-soldier']
}

// Get contextually relevant commands for a team in current game state
export function getContextualCommands(unitType, allCommands, limit = 6) {
  const typeDef = getUnitType(unitType)
  const available = typeDef.commands.filter(c => allCommands.includes(c) || true)
  return available.slice(0, limit)
}
