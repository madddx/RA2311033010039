const axios = require("axios");
const { Log, getToken } = require("../logging_middleware/index");

const BASE_URL = "http://20.207.122.201/evaluation-service";

// Always get fresh token dynamically from logging middleware
function getHeaders() {
  return { Authorization: `Bearer ${getToken()}` };
}

// ─── Fetch Depots ─────────────────────────────────────────────────────────────
async function fetchDepots() {
  await Log("backend", "info", "service", "Fetching depots from API");
  try {
    const res = await axios.get(`${BASE_URL}/depots`, { headers: getHeaders() });
    const depots = res.data.depots;
    await Log("backend", "info", "service", `Fetched ${depots.length} depots successfully`);
    return depots;
  } catch (err) {
    await Log("backend", "error", "service", `Failed to fetch depots: ${err.message}`);
    throw err;
  }
}

// ─── Fetch Vehicles ───────────────────────────────────────────────────────────
async function fetchVehicles() {
  await Log("backend", "info", "service", "Fetching vehicles from API");
  try {
    const res = await axios.get(`${BASE_URL}/vehicles`, { headers: getHeaders() });
    const vehicles = res.data.vehicles;
    await Log("backend", "info", "service", `Fetched ${vehicles.length} vehicles successfully`);
    return vehicles;
  } catch (err) {
    await Log("backend", "error", "service", `Failed to fetch vehicles: ${err.message}`);
    throw err;
  }
}

// ─── 0/1 Knapsack Algorithm ───────────────────────────────────────────────────
function knapsack(vehicles, budget) {
  const n = vehicles.length;

  // Build DP table
  const dp = Array.from({ length: n + 1 }, () => Array(budget + 1).fill(0));

  for (let i = 1; i <= n; i++) {
    const { Duration, Impact } = vehicles[i - 1];
    for (let w = 0; w <= budget; w++) {
      // Option 1: skip this vehicle
      dp[i][w] = dp[i - 1][w];
      // Option 2: take this vehicle if it fits
      if (Duration <= w) {
        dp[i][w] = Math.max(dp[i][w], dp[i - 1][w - Duration] + Impact);
      }
    }
  }

  // Backtrack to find selected vehicles
  const selected = [];
  let w = budget;
  for (let i = n; i >= 1; i--) {
    if (dp[i][w] !== dp[i - 1][w]) {
      selected.push(vehicles[i - 1]);
      w -= vehicles[i - 1].Duration;
    }
  }

  return {
    maxImpact: dp[n][budget],
    selectedVehicles: selected.reverse(),
    hoursUsed: budget - w,
    hoursRemaining: w
  };
}

// ─── Main Scheduler ───────────────────────────────────────────────────────────
async function scheduleAllDepots() {
  await Log("backend", "info", "cron_job", "Vehicle maintenance scheduling job started");

  let depots, vehicles;

  try {
    depots = await fetchDepots();
    vehicles = await fetchVehicles();
  } catch (err) {
    await Log("backend", "fatal", "cron_job", `Scheduling job aborted: ${err.message}`);
    console.error("Fatal error fetching data. Exiting.");
    return;
  }

  console.log("\n============================================================");
  console.log("            VEHICLE MAINTENANCE SCHEDULER                   ");
  console.log("============================================================");
  console.log(`  Total Depots  : ${depots.length}`);
  console.log(`  Total Vehicles: ${vehicles.length}`);
  console.log("============================================================\n");

  for (const depot of depots) {
    const { ID, MechanicHours } = depot;

    await Log("backend", "info", "cron_job",
      `Processing Depot ${ID} with budget of ${MechanicHours} mechanic-hours`
    );

    try {
      const result = knapsack(vehicles, MechanicHours);

      await Log("backend", "info", "cron_job",
        `Depot ${ID} result: ${result.selectedVehicles.length} vehicles selected, ` +
        `Total Impact=${result.maxImpact}, Hours Used=${result.hoursUsed}/${MechanicHours}`
      );

      console.log(`┌─── Depot ID: ${ID} ${"─".repeat(45 - String(ID).length)}┐`);
      console.log(`│  Budget          : ${MechanicHours} mechanic-hours`);
      console.log(`│  Hours Used      : ${result.hoursUsed}`);
      console.log(`│  Hours Remaining : ${result.hoursRemaining}`);
      console.log(`│  Total Impact    : ${result.maxImpact}`);
      console.log(`│  Vehicles Selected: ${result.selectedVehicles.length}`);
      console.log(`│`);

      if (result.selectedVehicles.length === 0) {
        console.log(`│  ⚠ No vehicles fit within the budget`);
      } else {
        result.selectedVehicles.forEach((v, i) => {
          console.log(`│  ${i + 1}. TaskID  : ${v.TaskID}`);
          console.log(`│     Duration : ${v.Duration}h  |  Impact: ${v.Impact}`);
        });
      }

      console.log(`└${"─".repeat(50)}┘\n`);

    } catch (err) {
      await Log("backend", "error", "cron_job",
        `Scheduler failed for Depot ${ID}: ${err.message}`
      );
      console.error(`  ✗ ERROR processing Depot ${ID}: ${err.message}\n`);
    }
  }

  await Log("backend", "info", "cron_job", "Vehicle maintenance scheduling job completed successfully");

  console.log("============================================================");
  console.log("              SCHEDULING JOB COMPLETE ✓                     ");
  console.log("============================================================\n");
}

// ─── Run ──────────────────────────────────────────────────────────────────────
scheduleAllDepots();