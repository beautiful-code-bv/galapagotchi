/*
 * Copyright (c) 2019. Beautiful Code BV, Rotterdam, Netherlands
 * Licensed under GNU GENERAL PUBLIC LICENSE Version 3.
 */

import { Vector3 } from "three"

import { HEXALOT_SHAPE } from "../island/island-logic"

import { IFabricEngine, MAX_INSTANCES } from "./fabric-engine"
import { FabricInstance } from "./fabric-instance"
import { IFeature } from "./features"
import { TensegrityFabric } from "./tensegrity-fabric"

const FLOATS_IN_VECTOR = 3
const HEXALOT_BITS = 128
const SPOT_CENTERS_FLOATS = HEXALOT_BITS * FLOATS_IN_VECTOR
const SPOT_CENTERS_SIZE = SPOT_CENTERS_FLOATS * Float32Array.BYTES_PER_ELEMENT

export const vectorFromFloatArray = (array: Float32Array, index: number, vector?: Vector3): Vector3 => {
    if (vector) {
        vector.set(array[index], array[index + 1], array[index + 2])
        return vector
    } else {
        return new Vector3(array[index], array[index + 1], array[index + 2])
    }
}

export class FabricKernel {
    private instanceArray: FabricInstance[] = []
    private instanceUsed: boolean[] = []
    private arrayBuffer: ArrayBuffer
    private spotCenters: Float32Array
    private hexalotBits: Int8Array

    constructor(engine: IFabricEngine, private roleFeatures: IFeature[]) {
        const fabricBytes = engine.init()
        this.arrayBuffer = engine.memory.buffer
        this.spotCenters = new Float32Array(this.arrayBuffer, 0, SPOT_CENTERS_FLOATS)
        this.hexalotBits = new Int8Array(this.arrayBuffer, SPOT_CENTERS_SIZE, HEXALOT_BITS)
        const byteLength = this.arrayBuffer.byteLength
        if (byteLength === 0) {
            throw new Error(`Zero byte length! ${fabricBytes}`)
        }
        for (let index = 0; index < MAX_INSTANCES; index++) {
            this.instanceArray.push(new FabricInstance(
                this.arrayBuffer,
                index,
                toFree => this.instanceUsed[toFree] = false,
                engine,
            ))
            this.instanceUsed.push(false)
        }
    }

    public createTensegrityFabric(name: string, pretenst: number): TensegrityFabric | undefined {
        const newInstance = this.allocateInstance(pretenst)
        if (!newInstance) {
            return undefined
        }
        return new TensegrityFabric(newInstance, this.roleFeatures, name)
    }

    public setHexalot(spotCenters: Vector3[], surface: boolean[]): void {
        if (spotCenters.length !== HEXALOT_SHAPE.length || surface.length !== HEXALOT_SHAPE.length) {
            throw new Error("Size problem")
        }
        spotCenters.forEach((center, index) => {
            this.spotCenters[index * FLOATS_IN_VECTOR] = center.x
            this.spotCenters[index * FLOATS_IN_VECTOR + 1] = center.y
            this.spotCenters[index * FLOATS_IN_VECTOR + 2] = center.z
        })
        surface.forEach((land, index) => {
            this.hexalotBits[index] = land ? 1 : 0
        })
    }

    // ==============================================================

    private allocateInstance(pretenst: number): FabricInstance | undefined {
        const freeIndex = this.instanceUsed.indexOf(false)
        if (freeIndex < 0) {
            return undefined
        }
        this.instanceUsed[freeIndex] = true
        this.instanceArray[freeIndex].clear()
        this.instanceArray[freeIndex].engine.initInstance(pretenst)
        return this.instanceArray[freeIndex]
    }
}

