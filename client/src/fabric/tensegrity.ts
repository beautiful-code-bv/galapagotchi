/*
 * Copyright (c) 2019. Beautiful Code BV, Rotterdam, Netherlands
 * Licensed under GNU GENERAL PUBLIC LICENSE Version 3.
 */

import { Fabric, Stage } from "eig"
import { BehaviorSubject } from "rxjs"
import { Vector3 } from "three"

import { CONNECTOR_LENGTH, IntervalRole, isPushRole, roleDefaultLength } from "./eig-util"
import { FabricInstance } from "./fabric-instance"
import { createBud, execute, FaceAction, IBud, IMark, ITenscript, markStringsToMarks, TenscriptNode } from "./tenscript"
import { IntervalRoleFilter, tipCandidates, TipPairInclude, triangulationCandidates } from "./tensegrity-logic"
import {
    acrossPush,
    averageScaleFactor,
    expectPush,
    FaceName,
    FaceSelection,
    faceToOriginMatrix,
    factorFromPercent,
    IFace,
    IInterval,
    IJoint,
    intervalJoins,
    IPercent,
    IRadialPull,
    jointDistance,
    jointLocation,
    locationFromFace,
    locationFromFaces,
    percentFromFactor,
    percentOrHundred,
    rotateForBestRing,
    Spin,
} from "./tensegrity-types"
import { Twist } from "./twist"

export type Job = (tensegrity: Tensegrity) => void

export class Tensegrity {
    public name: string
    public stage$: BehaviorSubject<Stage>
    public joints: IJoint[] = []
    public intervals: IInterval[] = []
    public connectors: IRadialPull[] = []
    public distancers: IRadialPull[] = []
    public faces: IFace[] = []

    private jobs: Job[] = []
    private buds: IBud[]
    private marks: Record<number, string> = {}

    constructor(
        public readonly location: Vector3, // TODO use it
        public readonly scale: IPercent,
        public readonly instance: FabricInstance,
        public readonly countdown: number,
        tenscript: ITenscript,
        tree: TenscriptNode,
    ) {
        this.instance.clear()
        this.stage$ = new BehaviorSubject(this.fabric.get_stage())
        this.marks = tenscript.marks
        this.name = tenscript.name
        this.buds = [createBud(this, tenscript, tree)]
    }

    public get fabric(): Fabric {
        return this.instance.fabric
    }

    public get intervalsWithStats(): IInterval[] {
        return this.intervals.filter(interval => interval.stats)
    }

    public createJoint(location: Vector3): IJoint {
        const index = this.fabric.create_joint(location.x, location.y, location.z)
        const newJoint: IJoint = {index, instance: this.instance}
        this.joints.push(newJoint)
        return newJoint
    }

    public removeJoint(joint: IJoint): void {
        this.fabric.remove_joint(joint.index)
        this.joints = this.joints.filter(j => j.index !== joint.index)
    }

    public createRadialPull(alpha: IFace, omega: IFace, pullScale?: IPercent): IRadialPull {
        const alphaJoint = this.createJoint(locationFromFace(alpha))
        const omegaJoint = this.createJoint(locationFromFace(omega))
        this.instance.refreshFloatView()
        const axis = this.creatAxis(alphaJoint, omegaJoint, pullScale)
        const alphaRestLength = alpha.ends.reduce((sum, end) => sum + jointDistance(alphaJoint, end), 0) / alpha.ends.length
        const omegaRestLength = omega.ends.reduce((sum, end) => sum + jointDistance(omegaJoint, end), 0) / omega.ends.length
        const alphaRays = alpha.ends.map(end => this.createRay(alphaJoint, end, alphaRestLength))
        const omegaRays = omega.ends.map(end => this.createRay(omegaJoint, end, omegaRestLength))
        const radialPull: IRadialPull = {alpha, omega, axis, alphaRays, omegaRays}
        switch (axis.intervalRole) {
            case IntervalRole.Connector:
                this.connectors.push(radialPull)
                break
            case IntervalRole.Distancer:
                this.distancers.push(radialPull)
                break
        }
        return radialPull
    }

    public createInterval(alpha: IJoint, omega: IJoint, intervalRole: IntervalRole, scale: IPercent): IInterval {
        const push = isPushRole(intervalRole)
        const targetLength = roleDefaultLength(intervalRole) * factorFromPercent(scale)
        const currentLength = targetLength === 0 ? 0 : jointDistance(alpha, omega)
        const countdown = this.countdown * Math.abs(targetLength - currentLength)
        const attack = countdown <= 0 ? 0 : 1 / countdown
        const index = this.fabric.create_interval(alpha.index, omega.index, push, currentLength, targetLength, attack)
        const interval: IInterval = {index, intervalRole, scale, alpha, omega, removed: false}
        this.intervals.push(interval)
        return interval
    }

    public changeIntervalScale(interval: IInterval, factor: number): void {
        interval.scale = percentFromFactor(factorFromPercent(interval.scale) * factor)
        this.fabric.multiply_rest_length(interval.index, factor, 100)
    }

    public removeInterval(interval: IInterval): void {
        this.intervals = this.intervals.filter(existing => existing.index !== interval.index)
        this.fabric.remove_interval(interval.index)
        this.intervals.forEach(existing => {
            if (existing.index > interval.index) {
                existing.index--
            }
        })
        interval.removed = true
    }

    public createFace(ends: IJoint[], pulls: IInterval[], spin: Spin, scale: IPercent, joint?: IJoint): IFace {
        const f0 = ends[0]
        const f1 = ends[2]
        const f2 = ends[1]
        const index = this.fabric.create_face(f0.index, f2.index, f1.index)
        const faceSelection = FaceSelection.None
        const pushes = [expectPush(f0), expectPush(f1), expectPush(f2)]
        const face: IFace = {index, spin, scale, ends, pushes, pulls, faceSelection, marks: [], joint}
        this.faces.push(face)
        return face
    }

    public removeFace(face: IFace): void {
        face.pulls.forEach(pull => this.removeInterval(pull))
        face.pulls = []
        this.fabric.remove_face(face.index)
        this.faces = this.faces.filter(existing => existing.index !== face.index)
        this.faces.forEach(existing => {
            if (existing.index > face.index) {
                existing.index--
            }
        })
        if (face.joint) {
            this.removeJoint(face.joint)
        }
    }

    public triangulate(include: IntervalRoleFilter): number {
        const candidates = triangulationCandidates(this.intervals, this.joints, include)
        candidates.forEach(({alpha, omega}) => {
            this.createInterval(alpha, omega, IntervalRole.PullC, percentOrHundred())
        })
        return candidates.length
    }

    public vulcanize(include: TipPairInclude): number {
        const candidates = tipCandidates(this.intervals, include)
        candidates.forEach(({alpha, omega}) => {
            console.log(`(${alpha.joint.index},${omega.joint.index})`, alpha.outwards.dot(omega.outwards))
            this.createInterval(alpha.joint, omega.joint, IntervalRole.PullC, percentOrHundred())
        })
        return candidates.length
    }

    public removeSlackPulls(): void {
        const slack = this.intervals
            .filter(({intervalRole}) => intervalRole === IntervalRole.PullC)
            .filter(pullC => pullC.alpha.instance.floatView.strains[pullC.index] === 0)
        slack.forEach(interval => this.removeInterval(interval))
    }

    public createTwistOn(baseFace: IFace, spin: Spin, scale: IPercent): Twist {
        const twist = new Twist(this, spin, scale, baseFace.ends.map(jointLocation).reverse())
        const face = twist.face(FaceName.a)
        this.connect(baseFace, face)
        return twist
    }

    public get stage(): Stage {
        return this.stage$.getValue()
    }

    public set stage(stage: Stage) {
        this.instance.stage = stage
        if (stage === Stage.Slack) {
            this.distancers.forEach(radialPull => {
                const {axis, alphaRays, omegaRays} = radialPull
                const intervals = [axis, ...alphaRays, ...omegaRays]
                intervals.forEach(ray => this.removeInterval(ray))
            })
            this.distancers = []
            this.instance.snapshot()
        }
        this.stage$.next(stage)
    }

    public do(job: Job): void {
        this.jobs.push(job)
    }

    public iterate(): boolean {
        const busy = this.instance.iterate()
        if (busy) {
            return busy
        }
        const job = this.jobs.shift()
        if (job) {
            job(this)
            return true
        }
        if (this.stage === Stage.Growing) {
            if (this.buds.length > 0) {
                this.buds = execute(this.buds)
                if (this.buds.length === 0) { // last one executed
                    faceStrategies(this, this.faces, this.marks).forEach(strategy => strategy.execute())
                }
                return false
            } else if (this.connectors.length > 0) {
                this.connectors = this.checkConnectors()
                return false
            }
            this.stage = Stage.Shaping
        }
        return false
    }

    public strainToStiffness(): void {
        const floatView = this.instance.floatView
        const pulls = this.intervals.filter(interval => {
            if (isPushRole(interval.intervalRole)) {
                return false
            }
            return jointLocation(interval.alpha).y >= 0 || jointLocation(interval.omega).y >= 0
        })
        const strains = floatView.strains
        const averagePullStrain = pulls.reduce((sum, interval) => sum + strains[interval.index], 0) / pulls.length
        const stiffnesses = new Float32Array(floatView.stiffnesses)
        pulls.forEach(pull => {
            const pullStrain = strains[pull.index]
            const normalizedStrain = pullStrain - averagePullStrain
            const strainFactor = normalizedStrain / averagePullStrain
            stiffnesses[pull.index] *= 1 + strainFactor
        })
        this.instance.restoreSnapshot()
        this.fabric.copy_stiffnesses(stiffnesses)
    }

    public findInterval(a: IJoint, b: IJoint): IInterval | undefined {
        return this.intervals.find(intervalJoins(a, b))
    }


    public createRadialPulls(faces: IFace[], action: FaceAction, actionScale?: IPercent): void {
        const centerBrickFaceIntervals = () => {
            const omniTwist = new Twist(this, Spin.LeftRight, percentFromFactor(averageScaleFactor(faces)), [locationFromFaces(faces)])
            this.instance.refreshFloatView()
            return faces.map(face => {
                const opposing = omniTwist.faces.filter(({spin, pulls}) => pulls.length > 0 && spin !== face.spin)
                const faceLocation = locationFromFace(face)
                const closestFace = opposing.reduce((a, b) => {
                    const aa = locationFromFace(a).distanceTo(faceLocation)
                    const bb = locationFromFace(b).distanceTo(faceLocation)
                    return aa < bb ? a : b
                })
                return this.createRadialPull(closestFace, face)
            })
        }
        switch (action) {
            case FaceAction.Distance:
                const pullScale = actionScale ? actionScale : percentFromFactor(0.75)
                if (!pullScale) {
                    throw new Error("Missing pull scale")
                }
                faces.forEach((faceA, indexA) => {
                    faces.forEach((faceB, indexB) => {
                        if (indexA <= indexB) {
                            return
                        }
                        this.createRadialPull(faceA, faceB, pullScale)
                    })
                })
                break
            case FaceAction.Join:
                switch (faces.length) {
                    case 2:
                        if (faces[0].spin === faces[1].spin) {
                            centerBrickFaceIntervals()
                        } else {
                            this.createRadialPull(faces[0], faces[1])
                        }
                        break
                    case 3:
                        centerBrickFaceIntervals()
                        break
                }
                break
        }
    }

    public checkConnectors(): IRadialPull[] {
        if (this.connectors.length === 0) {
            return this.connectors
        }
        const connectFaces = (alpha: IFace, omega: IFace) => {
            rotateForBestRing(alpha, omega)
            this.connect(alpha, omega)
        }
        return this.connectors.filter(({axis, alpha, omega, alphaRays, omegaRays}) => {
            if (axis.intervalRole === IntervalRole.Connector) {
                const distance = jointDistance(axis.alpha, axis.omega)
                if (distance <= CONNECTOR_LENGTH) {
                    connectFaces(alpha, omega)
                    this.removeInterval(axis)
                    alphaRays.forEach(i => this.removeInterval(i))
                    omegaRays.forEach(i => this.removeInterval(i))
                    return false
                }
            }
            return true
        })
    }

    public faceToOrigin(face: IFace): void {
        this.instance.apply(faceToOriginMatrix(face))
        this.instance.refreshFloatView()
    }

    private connect(faceA: IFace, faceB: IFace): IInterval[] {
        const reverseA = [...faceA.ends].reverse()
        const forwardB = faceB.ends
        const a = reverseA.map(acrossPush)
        const b = reverseA
        const c = forwardB
        const d = forwardB.map(acrossPush)

        function indexJoints(index: number): IIndexedJoints {
            return {
                a0: a[index],
                a1: a[(index + 1) % a.length],
                b0: b[index],
                b1: b[(index + 1) % b.length],
                c0: c[index],
                c1: c[(index + 1) % c.length],
                cN1: c[(index + c.length - 1) % c.length],
                d0: d[index],
                d1: d[(index + 1) % d.length],
            }
        }

        const scale = percentFromFactor((factorFromPercent(faceA.scale) + factorFromPercent(faceB.scale)) / 2)
        const pulls: IInterval[] = []
        for (let index = 0; index < b.length; index++) {
            const {b0, b1, c0} = indexJoints(index)
            pulls.push(this.createInterval(b0, c0, IntervalRole.PullA, scale))
            pulls.push(this.createInterval(c0, b1, IntervalRole.PullA, scale))
        }
        this.removeFace(faceB)
        this.removeFace(faceA)
        return pulls
    }

    // =========================

    private creatAxis(alpha: IJoint, omega: IJoint, pullScale?: IPercent): IInterval {
        const idealLength = jointDistance(alpha, omega)
        const intervalRole = pullScale ? IntervalRole.Distancer : IntervalRole.Connector
        const restLength = pullScale ? factorFromPercent(pullScale) * idealLength : CONNECTOR_LENGTH / 2
        const scale = percentOrHundred()
        const countdown = this.countdown * Math.abs(restLength - idealLength)
        const attack = 1 / countdown
        const index = this.fabric.create_interval(alpha.index, omega.index, false, idealLength, restLength, attack)
        const interval: IInterval = {index, alpha, omega, intervalRole, scale, removed: false}
        this.intervals.push(interval)
        return interval
    }

    private createRay(alpha: IJoint, omega: IJoint, restLength: number): IInterval {
        const idealLength = jointDistance(alpha, omega)
        const intervalRole = IntervalRole.Radial
        const scale = percentFromFactor(restLength)
        const countdown = this.countdown * Math.abs(restLength - idealLength)
        const attack = 1 / countdown
        const index = this.fabric.create_interval(alpha.index, omega.index, false, idealLength, restLength, attack)
        const interval: IInterval = {index, alpha, omega, intervalRole, scale, removed: false}
        this.intervals.push(interval)
        return interval
    }
}

interface IIndexedJoints {
    a0: IJoint,
    a1: IJoint,
    b0: IJoint,
    b1: IJoint,
    c0: IJoint,
    c1: IJoint,
    cN1: IJoint,
    d0: IJoint,
    d1: IJoint,
}

function faceStrategies(tensegrity: Tensegrity, faces: IFace[], markStrings?: Record<number, string>): FaceStrategy[] {
    const marks = markStringsToMarks(markStrings)
    const collated: Record<number, IFace[]> = {}
    faces.forEach(face => {
        face.marks.forEach(mark => {
            const found = collated[mark._]
            if (found) {
                found.push(face)
            } else {
                collated[mark._] = [face]
            }
        })
    })
    return Object.entries(collated).map(([key]) => {
        const possibleMark = marks[key] || marks[-1]
        const mark = possibleMark ? possibleMark : FaceAction.None
        return new FaceStrategy(tensegrity, collated[key], mark)
    })
}

class FaceStrategy {
    constructor(private tensegrity: Tensegrity, private faces: IFace[], private mark: IMark) {
    }

    public execute(): void {
        switch (this.mark.action) {
            case FaceAction.Base:
                this.tensegrity.faceToOrigin(this.faces[0])
                break
            case FaceAction.Join:
                this.tensegrity.createRadialPulls(this.faces, this.mark.action, this.mark.scale)
                break
            case FaceAction.Distance:
                this.tensegrity.createRadialPulls(this.faces, this.mark.action, this.mark.scale)
                break
            case FaceAction.Anchor:
                // this.builder.createFaceAnchor(this.faces[0], this.mark)
                break
        }
    }
}
