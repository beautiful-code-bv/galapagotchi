/*
 * Copyright (c) 2019. Beautiful Code BV, Rotterdam, Netherlands
 * Licensed under GNU GENERAL PUBLIC LICENSE Version 3.
 */

// eslint-disable-next-line @typescript-eslint/tslint/config
import "./vendor/bootstrap.min.css"
// eslint-disable-next-line @typescript-eslint/tslint/config
import "./index.css"

async function start(
    eig: typeof import("eig"),
    frozenWorld: typeof import("eig").World,
    stickyWorld: typeof import("eig").World,
    bouncyWorld: typeof import("eig").World,
): Promise<void> {
    const starter = await import("./start")
    await starter.startReact(eig, frozenWorld, stickyWorld, bouncyWorld)
}

async function load(): Promise<void> {
    const eig = await import("eig")
    // @ts-ignore
    start(eig, eig.World.new(eig.SurfaceCharacter.Frozen), eig.World.new(eig.SurfaceCharacter.Sticky), eig.World.new(eig.SurfaceCharacter.Bouncy))
}

load()
