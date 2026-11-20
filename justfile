default:
    @just --list

heal *args:
    deno task heal {{args}}

heal-batchsize-calibrate *args:
    deno task calibrate {{args}}

intel *args:
    deno task intel {{args}}

collect-pet *args:
    deno task collect-pet {{args}}

rebuild:
    deno task rebuild
