"use client"

import { useRouter } from "next/navigation";

import { Visualization } from "../../../../components/visualization";
import stacking from '../../../../test/stacking.json';

export default function Page() {
    const router = useRouter();

    return (
        <Visualization stackingData={stacking} />
    );
}