def generate_timetable(subjects, total_hours):
    timetable = {}
    priorities = []
    normalized_subjects = []
    
    # Normalize subjects and calculate priority based on accuracy
    for s in subjects:
        if isinstance(s, str):
            name = s
            correct = 5
            total = 10
        elif isinstance(s, dict):
            name = s.get("name", "Unknown")
            correct = s.get("correct_questions", 5)
            total = s.get("total_questions", 10)
        else:
            continue

        if total <= 0:
            total = 1

        accuracy = (correct / total) * 100
        priority = max(1.0, 100.0 - accuracy)
        priorities.append(priority)
        normalized_subjects.append({"name": name, "priority": priority})

    total_priority = sum(priorities)
    if total_priority == 0:
        total_priority = max(1, len(normalized_subjects))

    # allocate study hours
    for s in normalized_subjects:
        allocated = (s["priority"] / total_priority) * total_hours
        timetable[s["name"]] = round(allocated, 2)

    return timetable