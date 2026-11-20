default:
    @just --list

heal *args:
    deno task kingshot-heal {{args}}

heal-batchsize-calibrate *args:
    deno task kingshot-calibrate {{args}}

rebuild:
    deno task rebuild
