/**
 * Utility for calculating durations between time events
 * Used for tracking patient, doctor, and staff time
 */

/**
 * Calculate durations from raw time events
 * @param {Array} events - Array of {label, time} objects
 * @returns {Object} - Object with calculated durations
 */
const calculateDurations = (events) => {
  if (!events || !Array.isArray(events) || events.length === 0) {
    return {
      patientDuration: 0,
      doctorDuration: 0,
      staffDuration: 0,
    };
  }

  // Sort events by time
  const sortedEvents = [...events].sort(
    (a, b) => new Date(a.time) - new Date(b.time)
  );

  // Initialize results
  const result = {
    patientDuration: 0,
    doctorDuration: 0,
    staffDuration: 0,
  };

  // Calculate patient duration (from first patient_start to last patient_end)
  const patientEvents = sortedEvents.filter((e) =>
    e.label.includes("patient_")
  );
  if (patientEvents.length >= 2) {
    const patientStarts = patientEvents.filter(
      (e) => e.label === "patient_start"
    );
    const patientEnds = patientEvents.filter((e) => e.label === "patient_end");

    if (patientStarts.length > 0 && patientEnds.length > 0) {
      const firstStart = new Date(patientStarts[0].time);
      const lastEnd = new Date(patientEnds[patientEnds.length - 1].time);

      if (lastEnd > firstStart) {
        result.patientDuration = Math.round((lastEnd - firstStart) / 60000); // Convert ms to minutes
      }
    }
  }

  // Calculate doctor duration (sum of all doctor_start -> doctor_end pairs)
  const doctorEvents = sortedEvents.filter((e) => e.label.includes("doctor_"));
  let doctorStart = null;

  for (const event of doctorEvents) {
    if (event.label === "doctor_start" && doctorStart === null) {
      doctorStart = new Date(event.time);
    } else if (event.label === "doctor_end" && doctorStart !== null) {
      const doctorEnd = new Date(event.time);
      result.doctorDuration += Math.round((doctorEnd - doctorStart) / 60000);
      doctorStart = null; // Reset for the next pair
    }
  }

  // Calculate staff duration (sum of all staff_start -> staff_end pairs)
  const staffEvents = sortedEvents.filter((e) => e.label.includes("staff_"));
  let staffStart = null;

  for (const event of staffEvents) {
    if (event.label === "staff_start" && staffStart === null) {
      staffStart = new Date(event.time);
    } else if (event.label === "staff_end" && staffStart !== null) {
      const staffEnd = new Date(event.time);
      result.staffDuration += Math.round((staffEnd - staffStart) / 60000);
      staffStart = null; // Reset for the next pair
    }
  }

  return result;
};

/**
 * Validate time tracking events
 * @param {Array} events - Array of {label, time} objects
 * @returns {Object} - {isValid: boolean, errors: Array}
 */
const validateTimeEvents = (events) => {
  if (!events || !Array.isArray(events)) {
    return { isValid: false, errors: ["Events must be an array"] };
  }

  const errors = [];
  const validLabels = [
    "patient_start",
    "patient_end",
    "doctor_start",
    "doctor_end",
    "staff_start",
    "staff_end",
  ];

  // Check each event has required properties and valid values
  for (let i = 0; i < events.length; i++) {
    const event = events[i];

    if (!event.label) {
      errors.push(`Event at index ${i} is missing a label`);
    } else if (!validLabels.includes(event.label)) {
      errors.push(`Event at index ${i} has invalid label: ${event.label}`);
    }

    if (!event.time) {
      errors.push(`Event at index ${i} is missing a time`);
    } else {
      // Validate time is a parseable date
      const date = new Date(event.time);
      if (isNaN(date.getTime())) {
        errors.push(`Event at index ${i} has invalid time: ${event.time}`);
      }
    }
  }

  // Check for logical consistency (optional but recommended)
  // For example, ensure patient_start comes before patient_end

  return {
    isValid: errors.length === 0,
    errors,
  };
};

module.exports = {
  calculateDurations,
  validateTimeEvents,
};
