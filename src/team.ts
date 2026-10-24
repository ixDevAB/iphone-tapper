const text = new TextDecoder();

const subject = async (pem: string) => {
  const child = new Deno.Command("openssl", {
    args: ["x509", "-noout", "-subject"],
    stdin: "piped",
    stdout: "piped",
    stderr: "null",
  }).spawn();
  const writer = child.stdin.getWriter();
  await writer.write(new TextEncoder().encode(pem));
  await writer.close();
  return text.decode((await child.output()).stdout);
};

export const findTeams = async () => {
  const { stdout } = await new Deno.Command("security", {
    args: ["find-certificate", "-a", "-c", "Apple Development", "-p"],
    stderr: "null",
  }).output();
  const pems = text.decode(stdout).match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g) ?? [];
  const teams = (await Promise.all(pems.map(subject)))
    .map((s) => ({ id: s.match(/OU\s*=\s*(\w+)/)?.[1], name: s.match(/O\s*=\s*([^,\n]+)/)?.[1] }))
    .filter((t): t is { id: string; name: string } => Boolean(t.id && t.name));
  return [...new Map(teams.map((t) => [t.id, t])).values()];
};

export const pickTeam = async () => {
  const teams = await findTeams();
  if (teams.length === 0) {
    throw new Error(
      "no apple development certificate found, sign in to xcode under Settings > Accounts and create one with Manage Certificates",
    );
  }
  if (teams.length > 1) {
    throw new Error(
      `several developer teams found, put one in .env as TEAM_ID:\n${
        teams.map((t) => `  TEAM_ID=${t.id}  (${t.name})`).join("\n")
      }`,
    );
  }
  return teams[0].id;
};
