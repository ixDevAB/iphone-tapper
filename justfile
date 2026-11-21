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

claim-freebies *args:
    deno task claim-freebies {{args}}

claim-vip *args:
    deno task claim-vip {{args}}

collect-daily *args:
    deno task collect-daily {{args}}

collect-conquest *args:
    deno task collect-conquest {{args}}

collect-backpack *args:
    deno task collect-backpack {{args}}

run *args:
    deno task run {{args}}

collect-all *args:
    deno task collect-all {{args}}

claim-all *args:
    deno task claim-all {{args}}

rebuild:
    deno task rebuild
