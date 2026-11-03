#!/usr/bin/env bash
# Everything of phase 1d tasks 3 and 4 that is still to run (the M1-strict and M0-guarded grouping arms and the smoke runs are done), once the OpenRouter account has credit again. Safe to re-run:
# resumed runs only redo their failed or missing rows. One run at a time (OpenRouter holds credit for in-flight requests).
cd /h/Apps/DCP-hw-wt/apps/api
R="--datasets-root ../../hw-evals/datasets --runs-root ../../hw-evals/cost1d/runs"
export HW_OPENAI_EXPLICIT_CACHE_ENABLED=true
t4() { # profile grouping [resume-id]
  local p=$1 g=$2 seed=$(( $2 * 11 )); local resume=""; [ -n "$3" ] && resume="--resume $3"
  echo; echo "######## T4 $p grouping $g (seed $seed) x2 on smallrun-b@v1 $resume"
  npm run hw:eval -- --dataset smallrun-b@v1 --profile R0,$p --mode mark --repeat 2 --seed $seed --fixed-grouping --budget-inr 10 --concurrency 2 --label "phase1d t4 grouping g$g ($p)" $resume $R 2>&1 | grep -vE "^> |^$|npm warn"
}
t3() { # dataset profile cap
  echo; echo "######## T3 $2 on $1 x5 (cap ₹$3)"
  npm run hw:eval -- --dataset $1 --profile R0,$2 --mode mark --repeat 5 --budget-inr $3 --concurrency 2 --label "phase1d t3 ${1%@*} ($2)" $R 2>&1 | grep -vE "^> |^$|npm warn"
}
t4 M0-strict 1 run_20261103_6c3f644b
t4 M0-strict 2 run_20261103_899ac9ef
t4 M0-strict 3 run_20261103_2e55a057
# resume the budget-capped heldout-1d M1-strict run (2 of 5 repeats done)
echo; echo '######## T3 M1-strict on heldout-1d@v1 x5 (resume)'
npm run hw:eval -- --dataset heldout-1d@v1 --profile R0,M1-strict --mode mark --repeat 5 --budget-inr 17 --concurrency 4 --label 'phase1d t3 heldout-1d (M1-strict)' --resume run_20261103_88bd0691 $R 2>&1 | grep -vE '^> |^$|npm warn'
t3 heldout-1d@v1 M0-strict 75
t3 heldout-1c@v1 M1-strict 13
t3 heldout-1c@v1 M0-strict 56
echo; echo CHAINC DONE
