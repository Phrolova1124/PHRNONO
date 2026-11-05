// Milliseconds. Durations include the final overlay exit, not network requests.
export const terminalExitMs = 680;
export const terminalPhases = ["assembly", "scan", "records", "confirm", "clearance", "welcome", "reveal"];

// Each chapter has time to finish its longest staggered CSS animation.
// Access clearance/welcome reveal the real login form instead of a second seal.
export const terminalTimelines = {
  public: { stages: [1700, 3100, 4450, 6250, 7750, 9520], duration: 12000 - terminalExitMs },
  access: { stages: [1750, 3250, 4700, 6600, 9000, 11300], build: [7400, 9000, 9900, 11300], duration: 13000 - terminalExitMs },
  authorized: { stages: [1850, 3550, 5250, 7450, 9450, 11420], duration: 14000 - terminalExitMs },
};
