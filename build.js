import { exec, spawnSync } from "child_process";

spawnSync('npm', ['run', 'build:setup']);
spawnSync('npm', ['run', 'build:ls']);
spawnSync('npm', ['run', 'build:frontend']);