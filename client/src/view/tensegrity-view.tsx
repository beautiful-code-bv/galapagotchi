/*
 * Copyright (c) 2019. Beautiful Code BV, Rotterdam, Netherlands
 * Licensed under GNU GENERAL PUBLIC LICENSE Version 3.
 */

import * as React from "react"
import { useEffect, useState } from "react"
import { FaCog, FaDownload } from "react-icons/all"
import { Canvas, extend, ReactThreeFiber } from "react-three-fiber"
import { Button, ButtonDropdown, ButtonGroup, DropdownItem, DropdownMenu, DropdownToggle } from "reactstrap"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls"

import { IFabricEngine } from "../fabric/fabric-engine"
import { IFeature } from "../fabric/features"
import { ISelectedFace } from "../fabric/tensegrity-brick-types"
import { TensegrityFabric } from "../fabric/tensegrity-fabric"
import { saveCSVFiles, saveOBJFile } from "../storage/download"
import { loadFabricCode, loadStorageIndex, storeStorageIndex } from "../storage/local-storage"

import { CommandPanel } from "./command-panel"
import { FabricView } from "./fabric-view"
import { FeaturePanel } from "./feature-panel"
import { TensegrityEditPanel } from "./tensegrity-edit-panel"

extend({OrbitControls})

declare global {
    namespace JSX {
        /* eslint-disable @typescript-eslint/interface-name-prefix */
        interface IntrinsicElements {
            orbitControls: ReactThreeFiber.Object3DNode<OrbitControls, typeof OrbitControls>
        }

        /* eslint-enable @typescript-eslint/interface-name-prefix */
    }
}

export function TensegrityView({engine, getFabric, features}: {
    engine: IFabricEngine,
    getFabric: (name: string) => TensegrityFabric,
    features: IFeature[],
}): JSX.Element {

    const [autoRotate, setAutoRotate] = useState<boolean>(false)
    const [fastMode, setFastMode] = useState<boolean>(false)
    const [storageIndex, setStorageIndex] = useState<number>(loadStorageIndex)
    const [fabric, setFabric] = useState<TensegrityFabric | undefined>()
    const [selectedFace, setSelectedFace] = useState<ISelectedFace | undefined>()

    useEffect(() => {
        if (!fabric) {
            const code = loadFabricCode()[loadStorageIndex()]
            const fetched = getFabric(code)
            fetched.startConstruction(code)
            setFabric(fetched)
        }
    })

    function constructFabric(code: string): void {
        setSelectedFace(undefined)
        if (fabric) {
            fabric.startConstruction(code)
        } else {
            const fetched = getFabric(code)
            fetched.startConstruction(code)
            setFabric(fetched)
        }
    }

    const FabricChoice = (): JSX.Element => {
        const [open, setOpen] = useState<boolean>(false)
        const select = (code: string, index: number) => {
            setStorageIndex(index)
            storeStorageIndex(index)
            constructFabric(code)
        }

        const fabricCode = loadFabricCode()
        return (
            <div style={{position: "absolute", top: "1em", left: "1em"}}>
                <ButtonDropdown className="w-100 my-2 btn-info" isOpen={open} toggle={() => setOpen(!open)}>
                    <DropdownToggle>
                        <FaCog/> {fabricCode[storageIndex]}
                    </DropdownToggle>
                    <DropdownMenu right={false}>
                        {fabricCode.map((code, index) => (
                            <DropdownItem key={`Buffer${index}`} onClick={() => select(code, index)}>
                                {code}
                            </DropdownItem>
                        ))}
                    </DropdownMenu>
                </ButtonDropdown>
            </div>
        )
    }

    const Download = (): JSX.Element => {
        const onDownloadCSV = () => {
            if (fabric) {
                saveCSVFiles(fabric)
            }
        }
        const onDownloadOBJ = () => {
            if (fabric) {
                saveOBJFile(fabric)
            }
        }
        return (
            <ButtonGroup style={{position: "absolute", bottom: "1em", left: "1em"}}>
                <Button onClick={onDownloadCSV}><FaDownload/>CSV</Button>
                <Button onClick={onDownloadOBJ}><FaDownload/>OBJ</Button>
            </ButtonGroup>
        )
    }

    return (
        <div id="tensegrity-view" className="the-whole-page">
            <Canvas>
                {!fabric ? undefined : (
                    <FabricView
                        fabric={fabric}
                        selectedFace={selectedFace}
                        setSelectedFace={setSelectedFace}
                        autoRotate={autoRotate}
                        fastMode={fastMode}
                    />
                )}
            </Canvas>
            <FabricChoice/>
            <FeaturePanel
                featureSet={features}
                engine={engine}
                fabric={fabric}
            />
            <Download/>
            <TensegrityEditPanel
                fabric={fabric}
                selectedFace={selectedFace}
                setSelectedFace={setSelectedFace}
            />
            <CommandPanel
                constructFabric={constructFabric}
                fabric={fabric}
                autoRotate={autoRotate}
                setAutoRotate={setAutoRotate}
                fastMode={fastMode}
                setFastMode={setFastMode}
                storageIndex={storageIndex}
            />
        </div>
    )
}

