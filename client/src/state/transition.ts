/*
 * Copyright (c) 2019. Beautiful Code BV, Rotterdam, Netherlands
 * Licensed under GNU GENERAL PUBLIC LICENSE Version 3.
 */

import { Evolution } from "../gotchi/evolution"
import { Gotchi } from "../gotchi/gotchi"
import { Hexalot } from "../island/hexalot"
import { Journey } from "../island/journey"
import { Spot, Surface } from "../island/spot"

import { IAppState, Mode } from "./app-state"

export class Transition {

    private appState: IAppState

    constructor(prev: IAppState) {
        this.appState = {...prev, nonce: prev.nonce + 1}
    }

    public get state(): IAppState {
        return this.appState
    }

    public withMode(mode: Mode): Transition {
        this.recycle()
        this.appState = {...this.appState, mode}
        return this
    }

    public withJourney(journey?: Journey): Transition {
        this.appState = {...this.appState, journey}
        return this
    }

    public async withSelectedHexalot(selectedHexalot?: Hexalot): Promise<Transition> {
        this.appState = {...this.appState, selectedHexalot}
        if (selectedHexalot && !selectedHexalot.genome) {
            selectedHexalot.genome = await selectedHexalot.fetchGenome(this.appState.storage)
            console.log(`Genome for ${selectedHexalot.id}`, selectedHexalot.genome)
            return this
        }
        return this
    }

    public async withSelectedSpot(selectedSpot?: Spot): Promise<Transition> {
        this.appState = {...this.appState, selectedSpot}
        if (selectedSpot) {
            return this.withSelectedHexalot(selectedSpot.centerOfHexalot)
        }
        return this.withSelectedHexalot()
    }

    public withIslandIsLegal(islandIsLegal: boolean): Transition {
        this.appState = {...this.appState, islandIsLegal}
        return this
    }

    public async withHomeHexalot(homeHexalot?: Hexalot): Promise<Transition> {
        this.appState = {...this.appState, homeHexalot}
        if (!homeHexalot) {
            return this.withMode(Mode.Visiting).withJourney().withSelectedSpot()
        }
        homeHexalot.journey = await homeHexalot.fetchJourney(this.appState.storage, this.appState.island)
        console.log(`Journey for ${homeHexalot.id}`, homeHexalot.journey)
        return (await this.withSelectedSpot(homeHexalot.centerSpot)).withJourney(homeHexalot.journey).withMode(Mode.Landed)
    }

    public get withRestructure(): Transition {
        const island = this.appState.island
        island.recalculate()
        const hexalots = island.hexalots
        const spots = island.spots
        const vacant = island.vacantHexalot
        if (hexalots.length === 1) {
            spots.forEach(spot => spot.free = true)
        } else if (vacant) {
            spots.forEach(spot => spot.free = spot.memberOfHexalot.every(hexalot => hexalot.id === vacant.id))
        } else {
            spots.forEach(spot => spot.free = false)
        }
        hexalots.forEach(hexalot => hexalot.refreshId())
        const islandIsLegal = island.islandIsLegal
        if (islandIsLegal) {
            this.appState = {...this.appState, islandIsLegal}
        } else {
            this.appState = {...this.appState, islandIsLegal, mode: Mode.FixingIsland}
        }
        return this
    }

    public async withSurface(surface: Surface): Promise<Transition> {
        const appState = this.appState
        const selectedSpot = appState.selectedSpot
        if (!selectedSpot) {
            return this
        }
        selectedSpot.surface = surface
        selectedSpot.memberOfHexalot.forEach(hexalot => hexalot.refreshId())
        const nextFree = selectedSpot.adjacentSpots.find(s => s.free && s.surface === Surface.Unknown)
        if (nextFree) {
            return this.withSelectedSpot(nextFree)
        }
        const island = appState.island
        const anyFree = island.spots.find(s => s.free && s.surface === Surface.Unknown)
        if (anyFree) {
            return this.withSelectedSpot(anyFree)
        }
        const illegal = island.spots.find(s => !s.isLegal)
        if (illegal) {
            return this.withSelectedSpot(illegal)
        }
        const vacantHexalot = island.vacantHexalot
        if (vacantHexalot) {
            return this.withSelectedSpot(vacantHexalot.centerSpot)
        }
        return this
    }

    public withGotchi(gotchi: Gotchi, journey?: Journey): Transition {
        this.recycle()
        const mode = journey ? Mode.DrivingJourney : Mode.DrivingFree
        this.appState = {...this.appState, gotchi, journey, mode}
        return this
    }

    public withEvolution(evolution: Evolution): Transition {
        this.recycle()
        this.appState = {...this.appState, evolution, mode: Mode.Evolving}
        return this
    }

    private recycle(): void {
        const gotchi = this.appState.gotchi
        if (gotchi) {
            gotchi.recycle()
            this.appState = {...this.appState, gotchi: undefined}
        }
        const evolution = this.appState.evolution
        if (evolution) {
            evolution.recycle()
            this.appState = {...this.appState, evolution: undefined}
        }
    }
}
