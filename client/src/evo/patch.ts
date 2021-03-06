/*
 * Copyright (c) 2020. Beautiful Code BV, Rotterdam, Netherlands
 * Licensed under GNU GENERAL PUBLIC LICENSE Version 3.
 */

import { Vector3 } from "three"

import { Flora } from "./flora"
import { emptyGenome, IGeneData } from "./genome"
import { ICoords, Island, PatchCharacter } from "./island"
import { HEXAGON_POINTS, NORMAL_SPREAD, SCALE_X, SCALE_Y, SIX, UP } from "./island-geometry"
import { Runner } from "./runner"

export class Patch {
    public runner?: Runner
    public flora?: Flora
    public readonly center: Vector3
    public readonly name: string
    public adjacent: (Patch | undefined)[] = []

    constructor(
        public readonly island: Island,
        public readonly coords: ICoords,
        public patchCharacter: PatchCharacter,
    ) {
        this.center = new Vector3(coords.x * SCALE_X, 0, coords.y * SCALE_Y)
        this.name = `(${coords.x},${coords.y})`
    }

    public get storedGenes(): IGeneData[][] {
        const item = localStorage.getItem(this.name)
        return item ? JSON.parse(item) : [emptyGenome().geneData]
    }

    public set storedGenes(geneData: IGeneData[][]) {
        localStorage.setItem(this.name, JSON.stringify(geneData))
        // console.log(`Saving genome to ${this.name}`, geneData)
    }

    public get positionArray(): Float32Array {
        const array = new Float32Array(SIX * 3 * 3)
        let index = 0
        const add = (point: Vector3) => {
            const {x, y, z} = new Vector3().copy(this.center).addScaledVector(point, 0.99)
            array[index++] = x
            array[index++] = y
            array[index++] = z
        }
        for (let a = 0; a < SIX; a++) {
            const b = (a + 1) % SIX
            add(new Vector3())
            add(HEXAGON_POINTS[a])
            add(HEXAGON_POINTS[b])
        }
        return array
    }

    public get normalArray(): Float32Array {
        const array = new Float32Array(SIX * 3 * 3)
        let index = 0
        const add = ({x, y, z}: Vector3) => {
            array[index++] = x
            array[index++] = y
            array[index++] = z
        }
        for (let a = 0; a < SIX; a++) {
            const b = (a + 1) % SIX
            add(UP)
            add(new Vector3().add(UP).addScaledVector(HEXAGON_POINTS[a], NORMAL_SPREAD).normalize())
            add(new Vector3().add(UP).addScaledVector(HEXAGON_POINTS[b], NORMAL_SPREAD).normalize())
        }
        return array
    }
}
