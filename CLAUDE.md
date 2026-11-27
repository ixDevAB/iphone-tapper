# iphone-tapper

## Never interrupt an ongoing run

A run is a `just` task driving the phone (`deno ... src/start.ts <task>`). The user starts runs themselves, often long ones.

- Before anything that touches the phone, check for a run: `pgrep -fl "src/start.ts"`.
- If a run is going: do not start another task, do not run a probe or test script against the phone, do not stop or restart the helper on the phone, and do not kill the run. Two things driving the phone at once break both.
- Stop a run only when the user asks for it in that message.
- Editing code, running `deno test` and reading `decisions.log` are fine while a run is going. A run keeps the code it started with.
- If work needs the phone and a run is going, say so and wait for the user.
