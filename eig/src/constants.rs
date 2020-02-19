/*
 * Copyright (c) 2020. Beautiful Code BV, Rotterdam, Netherlands
 * Licensed under GNU GENERAL PUBLIC LICENSE Version 3.
 */

use wasm_bindgen::prelude::*;

pub const ATTENUATED_COLOR: [f32; 3] = [0.0, 0.0, 0.0];

pub const SLACK_COLOR: [f32; 3] = [0.0, 1.0, 0.0];

pub const ROLE_COLORS: [[f32; 3]; 9] = [
    [0.799, 0.519, 0.304],
    [0.879, 0.295, 0.374],
    [0.215, 0.629, 0.747],
    [0.618, 0.126, 0.776],
    [0.670, 0.627, 0.398],
    [0.242, 0.879, 0.410],
    [0.613, 0.692, 0.382],
    [0.705, 0.709, 0.019],
    [0.577, 0.577, 0.577],
];

pub const RAINBOW: [[f32; 3]; 12] = [
    [0.1373, 0.1608, 0.9686],
    [0.0000, 0.4824, 1.0000],
    [0.0000, 0.6471, 1.0000],
    [0.0000, 0.7686, 0.8431],
    [0.0000, 0.8667, 0.6784],
    [0.3059, 0.8667, 0.5137],
    [0.5020, 0.8549, 0.3216],
    [0.6863, 0.8235, 0.0000],
    [0.8314, 0.7098, 0.0000],
    [0.9294, 0.5804, 0.0000],
    [0.9843, 0.4431, 0.1647],
    [0.9882, 0.3020, 0.3020],
];

pub const SHAPE_COUNT: usize = 16;
pub const REST_SHAPE: u8 = 0;

#[wasm_bindgen]
#[repr(u8)]
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd)]
pub enum Stage {
    Busy,
    Growing,
    Shaping,
    Slack,
    Realizing,
    Realized,
}

#[wasm_bindgen]
#[repr(u8)]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum SurfaceCharacter {
    Frozen,
    Sticky,
    Slippery,
    Bouncy,
}

#[wasm_bindgen]
#[repr(u8)]
#[derive(Clone, Copy, Debug, Hash, PartialEq, Eq)]
pub enum FabricFeature {
    Gravity,
    Drag,
    PretenstFactor,
    IterationsPerFrame,
    IntervalCountdown,
    RealizingCountdown,
    SlackThreshold,
    ShapingPretenstFactor,
    ShapingStiffnessFactor,
    ShapingDrag,
    MaxStrain,
    VisualStrain,
    NexusPushLength,
    ColumnPushLength,
    TriangleLength,
    RingLength,
    NexusCrossLength,
    ColumnCrossLength,
    BowMidLength,
    BowEndLength,
    PushOverPull,
    PushRadiusFactor,
    PullRadiusFactor,
    MaxStiffness,
}

const ROOT2: f32 = 1.414213562373095;
const ROOT3: f32 = 1.732050807568877;
const ROOT5: f32 = 2.23606797749979;
const PHI: f32 = (1_f32 + ROOT5) / 2_f32;
const CROSS1: f32 = 0.5_f32;
const CROSS2: f32 = (PHI / 3_f32 - 1_f32 / 6_f32) * ROOT3;
const CROSS3: f32 = PHI / 3_f32 * ROOT3 - 1_f32 + ROOT2 / ROOT3;

#[wasm_bindgen]
pub fn default_fabric_feature(fabric_feature: FabricFeature) -> f32 {
    match fabric_feature {
        FabricFeature::Gravity => 0.0000001_f32,
        FabricFeature::Drag => 0.0001_f32,
        FabricFeature::PretenstFactor => 0.03_f32,
        FabricFeature::IterationsPerFrame => 100_f32,
        FabricFeature::IntervalCountdown => 1000_f32,
        FabricFeature::RealizingCountdown => 30000_f32,
        FabricFeature::SlackThreshold => 0.0001_f32,
        FabricFeature::ShapingPretenstFactor => 0.1_f32,
        FabricFeature::ShapingStiffnessFactor => 10_f32,
        FabricFeature::ShapingDrag => 0.1_f32,
        FabricFeature::MaxStrain => 0.1_f32,
        FabricFeature::VisualStrain => 1_f32,
        FabricFeature::NexusPushLength => PHI,
        FabricFeature::ColumnPushLength => ROOT2,
        FabricFeature::TriangleLength => 1_f32,
        FabricFeature::RingLength => (2_f32 - 2_f32 * (2_f32 / 3_f32).sqrt()).sqrt(),
        FabricFeature::NexusCrossLength => {
            (CROSS1 * CROSS1 + CROSS2 * CROSS2 + CROSS3 * CROSS3).sqrt()
        }
        FabricFeature::ColumnCrossLength => 1_f32,
        FabricFeature::BowMidLength => 0.4_f32,
        FabricFeature::BowEndLength => 0.6_f32,
        FabricFeature::PushOverPull => 1_f32,
        FabricFeature::PushRadiusFactor => 4_f32,
        FabricFeature::PullRadiusFactor => 2_f32,
        FabricFeature::MaxStiffness => 0.0005_f32,
    }
}

#[wasm_bindgen]
#[repr(u8)]
#[derive(Clone, Copy, Debug, Hash, PartialEq, Eq)]
pub enum IntervalRole {
    NexusPush,
    ColumnPush,
    Triangle,
    Ring,
    NexusCross,
    ColumnCross,
    BowMid,
    BowEnd,
    FacePull,
}

#[wasm_bindgen]
extern "C" {
    // Use `js_namespace` here to bind `console.log(..)` instead of just
    // `log(..)`
    #[wasm_bindgen(js_namespace = console)]
    pub fn log(s: &str);

    // The `console.log` is quite polymorphic, so we can bind it with multiple
    // signatures. Note that we need to use `js_name` to ensure we always call
    // `log` in JS.
    #[wasm_bindgen(js_namespace = console, js_name = log)]
    pub fn log_f32(s: &str, a: f32);

    // The `console.log` is quite polymorphic, so we can bind it with multiple
    // signatures. Note that we need to use `js_name` to ensure we always call
    // `log` in JS.
    #[wasm_bindgen(js_namespace = console, js_name = log)]
    pub fn log_u32(s: &str, a: u32);

}