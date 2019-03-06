import * as React from "react"
import * as R3 from "react-three"
import {Subscription} from "rxjs/Subscription"

import {Evolution} from "../gotchi/evolution"
import {Evolver} from "../gotchi/evolver"

import {GOTCHI_GHOST_MATERIAL, GOTCHI_POINTER_MATERIAL} from "./materials"

export interface IEvolutionProps {
    evolution: Evolution
}

export interface IEvolutionState {
    evolvers: Evolver[]
}

export class EvolutionComponent extends React.Component<IEvolutionProps, IEvolutionState> {

    private subscription: Subscription

    constructor(props: IEvolutionProps) {
        super(props)
        this.state = {
            evolvers: props.evolution.evolversNow.getValue(),
        }
    }

    public componentDidMount(): void {
        this.subscription = this.props.evolution.evolversNow.subscribe(evolvers => {
            this.setState({evolvers})
        })
    }

    public componentWillUnmount(): void {
        this.subscription.unsubscribe()
    }

    public render(): JSX.Element {
        return <R3.Object3D key="EvolutionMesh">
            {
                this.state.evolvers.map((evolver, index) => {
                    const gotchi = evolver.gotchi
                    const fabric = gotchi.fabric
                    return (
                        <R3.Object3D key={`Evolver${index}`}>
                            <R3.LineSegments
                                key="Vectors"
                                geometry={fabric.pointerGeometryFor(gotchi.direction)}
                                material={GOTCHI_POINTER_MATERIAL}
                            />
                            <R3.Mesh
                                geometry={fabric.facesGeometry}
                                material={GOTCHI_GHOST_MATERIAL}
                            />
                        </R3.Object3D>
                    )
                })
            }
        </R3.Object3D>
    }
}
