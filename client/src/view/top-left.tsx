/*
 * Copyright (c) 2021. Beautiful Code BV, Rotterdam, Netherlands
 * Licensed under GNU GENERAL PUBLIC LICENSE Version 3.
 */

import * as React from "react"
import { useState } from "react"
import { FaEye, FaHiking } from "react-icons/all"
import { Button, ButtonDropdown, ButtonGroup, DropdownItem, DropdownMenu, DropdownToggle } from "reactstrap"
import { useRecoilState, useSetRecoilState } from "recoil"

import { BOOTSTRAP } from "../fabric/bootstrap"
import { RunTenscript } from "../fabric/tenscript"
import { PostGrowthOp, Tensegrity } from "../fabric/tensegrity"
import { bootstrapIndexAtom, postGrowthAtom, tenscriptAtom, ViewMode, viewModeAtom } from "../storage/recoil"

import { ScriptPanel } from "./script-panel"
import { STAGE_TRANSITIONS, StageButton } from "./stage-button"

export function TopLeft({tensegrity, runTenscript}: {
    tensegrity: Tensegrity,
    runTenscript: RunTenscript,
}): JSX.Element {

    const [viewMode] = useRecoilState(viewModeAtom)
    const setBootstrapIndex = useSetRecoilState(bootstrapIndexAtom)
    const [tenscript] = useRecoilState(tenscriptAtom)
    const [postGrowth, setPostGrowth] = useRecoilState(postGrowthAtom)

    const [showScriptPanel, setShowScriptPanel] = useState(false)
    const [bootstrapOpen, setBootstrapOpen] = useState(false)

    const run = (pgo: PostGrowthOp) => {
        if (tenscript) {
            setPostGrowth(pgo)
            runTenscript(tenscript, pgo, error => console.error(error))
        }
    }

    const opColor = (pgo: PostGrowthOp) => postGrowth === pgo ? "success" : "secondary"

    return (
        <>
            <ButtonGroup>{STAGE_TRANSITIONS
                .map(stageTransition => (
                    <StageButton
                        key={`strans-${stageTransition}`}
                        tensegrity={tensegrity}
                        stageTransition={stageTransition}
                        disabled={viewMode === ViewMode.Frozen}/>
                ))
            }</ButtonGroup>
            <br/>
            <ButtonGroup className="my-1">
                <Button onClick={() => run(PostGrowthOp.NoOp)} color={opColor(PostGrowthOp.NoOp)}>0</Button>
                <Button onClick={() => run(PostGrowthOp.Faces)} color={opColor(PostGrowthOp.Faces)}>&#9653;</Button>
                <Button onClick={() => run(PostGrowthOp.Snelson)} color={opColor(PostGrowthOp.Snelson)}>S</Button>
                <Button onClick={() => run(PostGrowthOp.Bowtie)} color={opColor(PostGrowthOp.Bowtie)}>&#8904;</Button>
            </ButtonGroup>
            <br/>
            <ButtonGroup>
                <ButtonDropdown
                    isOpen={bootstrapOpen}
                    toggle={() => setBootstrapOpen(!bootstrapOpen)}
                >
                    <DropdownToggle><FaHiking/></DropdownToggle>
                    <DropdownMenu>{BOOTSTRAP.map((bootstrapProgram, index) => (
                        <DropdownItem key={`Boot${index}`} onClick={() => {
                            setBootstrapIndex(index)
                            runTenscript(bootstrapProgram, postGrowth, () => console.error("impossible"))
                        }}>
                            {bootstrapProgram.name}
                        </DropdownItem>
                    ))}</DropdownMenu>
                </ButtonDropdown>
                <Button
                    color={showScriptPanel ? "warning" : "secondary"}
                    onClick={() => setShowScriptPanel(!showScriptPanel)}>
                    <FaEye/>
                </Button>
            </ButtonGroup>
            {!showScriptPanel ? undefined : <ScriptPanel runTenscript={runTenscript}/>}
        </>
    )
}

