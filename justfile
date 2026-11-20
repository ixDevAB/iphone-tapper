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

terror-hunt *args:
    deno task terror-hunt {{args}}

claim-mail *args:
    deno task claim-mail {{args}}

claim-alliance *args:
    deno task claim-alliance {{args}}

recruit *args:
    deno task recruit {{args}}

morning *args:
    deno task morning {{args}}

shop *args:
    deno task shop {{args}}

rebuild:
    deno task rebuild
