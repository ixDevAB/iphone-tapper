default:
    @just --list

heal *args:
    deno task start heal {{args}}

heal-batchsize-calibrate *args:
    deno task start calibrate {{args}}

alias calibrate := heal-batchsize-calibrate

intel *args:
    deno task start intel {{args}}

collect-pet *args:
    deno task start collect-pet {{args}}

terror-hunt *args:
    deno task start terror-hunt {{args}}

claim-mail *args:
    deno task start claim-mail {{args}}

claim-alliance *args:
    deno task start claim-alliance {{args}}

recruit *args:
    deno task start recruit {{args}}

morning *args:
    deno task start morning {{args}}

shop *args:
    deno task start shop {{args}}

claim-freebies *args:
    deno task start claim-freebies {{args}}

claim-vip *args:
    deno task start claim-vip {{args}}

collect-daily *args:
    deno task start collect-daily {{args}}

collect-conquest *args:
    deno task start collect-conquest {{args}}

collect-backpack *args:
    deno task start collect-backpack {{args}}

backpack-names *args:
    deno task start backpack-names {{args}}

run *args:
    deno task start run {{args}}

collect-all *args:
    deno task start collect-all {{args}}

claim-all *args:
    deno task start claim-all {{args}}

rebuild:
    deno task start heal --rebuild

fmt:
    deno task fmt

check:
    deno task check

test:
    deno task test

runs *args:
    deno task runs {{args}}

decisions *args:
    deno task decisions {{args}}

train-troops *args:
    deno task start train-troops {{args}}

collect-water *args:
    deno task start collect-water {{args}}

collect-online *args:
    deno task start collect-online {{args}}

mystic-trial *args:
    deno task start mystic-trial {{args}}
