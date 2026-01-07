// OSMDtoScore.js
// Converts musicXML to midi (needs lots of features)

// Helper to extract playback data from OSMD's internal model
function convertOSMDToScore(osmdInstance, startBar, endBar) {
    const sheet = osmdInstance.sheet;
    const score = {
        meta: { bpm: 100 }, // Default BPM
        parts: []
    };

    // Try to find BPM from the sheet
    if (sheet.MetronomeMark) {
         score.meta.bpm = sheet.MetronomeMark.Tempo;
    } else if (sheet.SourceMeasures.length > 0 && sheet.SourceMeasures[0].TempoInBPM) {
         score.meta.bpm = sheet.SourceMeasures[0].TempoInBPM;
    }

    const voiceMap = new Map(); // voiceId -> { measures: [] }
    const debugData = []; // For logging purposes
    const simpleDebug = []; // Simplified log for user verification

    console.log(`[Audio] Converting OSMD to Score. Target Range: ${startBar} to ${endBar}`);

    // Iterate through all measures in the sheet
    let playbackMeasureIndex = 0;
    for (let i = 0; i < sheet.SourceMeasures.length; i++) {
        const measure = sheet.SourceMeasures[i];
        // Ensure we compare numbers
        const measureNumber = typeof measure.MeasureNumber === 'number' 
            ? measure.MeasureNumber 
            : parseInt(measure.MeasureNumber, 10);
        
        const measureDebug = {
            measureNumber: measureNumber,
            measureIndex: i,
            included: false,
            events: []
        };
        
        // Filter by bar range if provided
        if (startBar !== undefined && endBar !== undefined) {
            if (measureNumber < startBar || measureNumber > endBar) {
                debugData.push(measureDebug); // Log skipped measures to help debugging
                continue;
            }
        }
        measureDebug.included = true;
        const measureIndex = playbackMeasureIndex; 

        // Iterate vertical containers (timestamps within the measure)
        for (const vssec of measure.VerticalSourceStaffEntryContainers) {
            for (const staffEntry of vssec.StaffEntries) {
                if (!staffEntry) continue;

                const voiceEntries = staffEntry.VoiceEntries || staffEntry.voiceEntries || [];

                for (const voiceEntry of voiceEntries) {
                    let voiceId = voiceEntry.VoiceId;
                    if (voiceId === undefined && voiceEntry.ParentVoice) {
                        voiceId = voiceEntry.ParentVoice.VoiceId;
                    }
                    if (voiceId === undefined) voiceId = 0;
                    
                    if (!voiceMap.has(voiceId)) {
                        voiceMap.set(voiceId, { measures: [] });
                    }
                    const part = voiceMap.get(voiceId);
                    
                    // Ensure measure array exists for this index
                    if (!part.measures[measureIndex]) {
                        part.measures[measureIndex] = [];
                    }
                    const measureEvents = part.measures[measureIndex];

                    const notes = voiceEntry.Notes || voiceEntry.notes || [];
                    if (notes.length > 0) {
                        const firstNote = notes[0];
                        // OSMD Length.RealValue is based on Whole Note = 1.0
                        // audio-player.js expects 1.0 = Quarter Note.
                        // So we multiply by 4.
                        const lengthObj = firstNote.Length || firstNote.length;
                        let duration = 0;
                        if (lengthObj) {
                            const realValue = (lengthObj.RealValue !== undefined) ? lengthObj.RealValue : lengthObj.realValue;
                            if (realValue !== undefined) duration = realValue * 4 ;
                        }
                        
                        let event = null;
                        if (firstNote.isRest()) {
                            event = { type: "rest", duration: duration };
                        } else {
                            // Collect MIDI numbers for chord or single note
                            // Pitch.getHalfTone() returns the MIDI note number (e.g. 60 for Middle C)
                            const midis = notes.map(n => n.Pitch ? n.Pitch.getHalfTone() : 0).filter(m => m > 0);
                            
                            if (midis.length === 1) {
                                event = { type: "note", midi: midis[0], duration: duration };
                            } else if (midis.length > 1) {
                                event = { type: "chord", midi: midis, duration: duration };
                            }
                        }

                        if (event) {
                            measureEvents.push(event);
                            
                            // Create readable event for debug
                            const readableEvent = {
                                type: event.type,
                                duration: duration.toFixed(2), // Duration in quarter notes
                                voice: voiceId
                            };
                            
                            if (event.type === 'note') {
                                readableEvent.midi = event.midi;
                                readableEvent.pitch = notes[0].Pitch ? notes[0].Pitch.toString() : 'N/A';
                            } else if (event.type === 'chord') {
                                readableEvent.midis = event.midi;
                                readableEvent.pitches = notes.map(n => n.Pitch ? n.Pitch.toString() : 'N/A');
                            }
                            
                            measureDebug.events.push(readableEvent);
                        }
                    }
                }
            }
        }
        debugData.push(measureDebug);
        
        if (measureDebug.included) {
            simpleDebug.push({
                bar: measureNumber,
                index: i,
                events: measureDebug.events
            });
        }
        
        playbackMeasureIndex++;
    }
    
    console.log("[Audio] Filtered MusicXML Data (Debug):", debugData);
    console.log("[Audio] Playback Notes (Readable):", simpleDebug);
    score.debugData = debugData;
    score.simpleDebug = simpleDebug;
    
    score.parts = Array.from(voiceMap.values());
    return score;
}