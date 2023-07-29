import { exec, spawnSync } from "child_process";

spawnSync('npm', ['run', 'build:setup'],{stdio:'inherit'});
spawnSync('npm', ['run', 'build:ls']),{stdio:'inherit'};
spawnSync('npm', ['run', 'build:frontend'],{stdio:'inherit'});