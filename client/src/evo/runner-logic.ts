/*
 * Copyright (c) 2021. Beautiful Code BV, Rotterdam, Netherlands
 * Licensed under GNU GENERAL PUBLIC LICENSE Version 3.
 */

import { Vector3 } from "three"

import { FabricInstance } from "../fabric/fabric-instance"
import { Tensegrity } from "../fabric/tensegrity"
import { IFace, IJoint, jointLocation } from "../fabric/tensegrity-types"

import { GeneName, Genome } from "./genome"
import { Patch } from "./patch"

export enum Direction {
    Rest = "Rest",
    ToA = "ToA",
    ToB = "ToB",
    ToC = "ToC",
}

export const DIRECTIONS: Direction[] = Object.keys(Direction).map(k => Direction[k])

export function directionGene(direction: Direction): GeneName {
    switch (direction) {
        case Direction.ToA:
            return GeneName.ToA
        case Direction.ToB:
            return GeneName.ToB
        case Direction.ToC:
            return GeneName.ToC
        default:
            throw new Error(`No gene for direction ${direction}`)
    }
}

export interface IMuscle {
    intervalIndex: number
    name: string
    distance: number
}

export interface IRunnerState {
    patch: Patch
    targetPatch: Patch
    instance: FabricInstance
    midpoint: Vector3,
    muscles: IMuscle[]
    genome: Genome
    direction: Direction
    directionHistory: Direction[]
    autopilot: boolean
    timeSlice: number
    twitchesPerCycle: number
}

export function freshRunnerState(patch: Patch, instance: FabricInstance, genome: Genome): IRunnerState {
    return <IRunnerState>{
        patch,
        targetPatch: patch.adjacent[patch.rotation],
        instance,
        midpoint: new Vector3().copy(patch.center),
        muscles: [],
        extremities: [],
        genome,
        direction: Direction.Rest,
        directionHistory: [],
        autopilot: false,
        timeSlice: 0,
        reachedTarget: false,
        twitchesPerCycle: 30,
    }
}

export function findTopFace(tensegrity: Tensegrity): IFace {
    const top = tensegrity.faces.sort((a, b) => {
        const aa = a.joint
        const bb = b.joint
        if (!aa || !bb) {
            throw new Error("faces without joints")
        }
        const locA = jointLocation(aa)
        const locB = jointLocation(bb)
        return locA.y - locB.y
    }).pop()
    if (!top) {
        throw new Error("no top face")
    }
    return top
}

export function calculateDirections(toA: Vector3, toB: Vector3, toC: Vector3, face?: IFace): void {
    if (!face) {
        return
    }
    const joint = face.joint
    if (!joint) {
        return undefined
    }
    const locations = joint.instance.floatView.jointLocations
    const fromTo = (fromJoint: IJoint, toJoint: IJoint, vector: Vector3) => {
        const from = fromJoint.index * 3
        const to = toJoint.index * 3
        vector.set(locations[to] - locations[from], 0, locations[to + 2] - locations[from + 2])
        vector.normalize()
    }
    fromTo(joint, face.ends[0], toA)
    fromTo(joint, face.ends[1], toB)
    fromTo(joint, face.ends[2], toC)
}
