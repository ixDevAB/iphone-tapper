const root = new URL("..", import.meta.url).pathname;
const wdaDir = `${root}vendor/appium-ios/packages/webdriveragent`;
const buildDir = `${root}build`;

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const exists = (path: string) => Deno.stat(path).then(() => true, () => false);

const run = async (cmd: string, args: string[], cwd: string, log: string) => {
  const { code, stdout, stderr } = await new Deno.Command(cmd, { args, cwd }).output();
  await Deno.writeFile(`${root}${log}`, new Uint8Array([...stdout, ...stderr]));
  if (code !== 0) throw new Error(`${cmd} failed, see ${log}`);
};

const xcodeArgs = (udid: string, teamId: string, bundleId: string) => [
  "-project",
  "WebDriverAgent.xcodeproj",
  "-scheme",
  "WebDriverAgentRunner",
  "-destination",
  `id=${udid}`,
  "-derivedDataPath",
  buildDir,
  `DEVELOPMENT_TEAM=${teamId}`,
  `PRODUCT_BUNDLE_IDENTIFIER=${bundleId}`,
];

export const ensureWda = async (udid: string, teamId: string, bundleId: string, rebuild: boolean) => {
  if (!(await exists(wdaDir))) {
    console.log("downloading webdriveragent...");
    await Deno.mkdir(`${root}vendor`, { recursive: true });
    await run("git", [
      "clone",
      "--depth",
      "1",
      "--filter=blob:none",
      "--sparse",
      "https://github.com/appium/appium-ios.git",
    ], `${root}vendor`, "download.log");
    await run("git", ["sparse-checkout", "set", "packages/webdriveragent"], `${root}vendor/appium-ios`, "download.log");
  }
  if (rebuild || !(await exists(`${buildDir}/Build/Products`))) {
    console.log("building webdriveragent, this takes a few minutes...");
    await run("xcodebuild", [
      ...xcodeArgs(udid, teamId, bundleId),
      "-allowProvisioningUpdates",
      "CODE_SIGN_STYLE=Automatic",
      "build-for-testing",
    ], wdaDir, "build.log");
  }
};

const isReady = (base: string) =>
  fetch(`${base}/status`, { signal: AbortSignal.timeout(2000) })
    .then((r) => r.json())
    .then((s) => s.value?.ready === true, () => false);

const waitReady = async (base: string, deadline: number): Promise<void> => {
  if (await isReady(base)) return;
  if (Date.now() > deadline) throw new Error("webdriveragent did not start, see wda.log");
  await sleep(1000);
  return waitReady(base, deadline);
};

export const startWda = async (udid: string, teamId: string, bundleId: string, base: string) => {
  if (await isReady(base)) return undefined;
  console.log("starting webdriveragent on the phone...");
  const out = await Deno.open(`${root}wda.log`, { create: true, write: true, truncate: true });
  const err = await Deno.open(`${root}wda.log`, { write: true, append: true });
  const child = new Deno.Command("xcodebuild", {
    args: [...xcodeArgs(udid, teamId, bundleId), "test-without-building"],
    cwd: wdaDir,
    stdout: "piped",
    stderr: "piped",
  }).spawn();
  child.stdout.pipeTo(out.writable);
  child.stderr.pipeTo(err.writable);
  await Promise.race([
    waitReady(base, Date.now() + 3 * 60 * 1000),
    child.status.then(() => {
      throw new Error("webdriveragent stopped, see wda.log");
    }),
  ]);
  return child;
};
