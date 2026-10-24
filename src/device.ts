type Device = {
  hardwareProperties: { udid: string; reality: string; platform: string };
  connectionProperties: { pairingState?: string; tunnelIPAddress?: string };
  deviceProperties: { name: string };
};

const devicectl = async (args: string[]) => {
  const out = await Deno.makeTempFile({ suffix: ".json" });
  await new Deno.Command("xcrun", {
    args: ["devicectl", ...args, "--json-output", out],
    stdout: "null",
    stderr: "null",
  }).output();
  const json = await Deno.readTextFile(out).then(JSON.parse, () => ({}));
  await Deno.remove(out);
  return json.result;
};

export const findPhone = async (udid?: string) => {
  const { devices = [] }: { devices?: Device[] } = await devicectl(["list", "devices"]) ?? {};
  const phone = devices.find((d) =>
    d.hardwareProperties.reality === "physical" &&
    d.hardwareProperties.platform === "iOS" &&
    d.connectionProperties.pairingState === "paired" &&
    (!udid || d.hardwareProperties.udid === udid)
  );
  if (!phone) throw new Error("no iphone found, plug it in with a cable, unlock it and try again");

  const details: Device | undefined = await devicectl([
    "device",
    "info",
    "details",
    "--device",
    phone.hardwareProperties.udid,
  ]);
  const tunnelIp = details?.connectionProperties.tunnelIPAddress;
  if (!tunnelIp) throw new Error(`${phone.deviceProperties.name} is not reachable, unlock it and try again`);

  return { udid: phone.hardwareProperties.udid, name: phone.deviceProperties.name, tunnelIp };
};
