"""Small screen model for the CLI's SGR and cursor-up/erase redraw contract."""
import re


def reset_styles(output, *, composite=False):
    active = False
    for match in re.finditer(r"\x1b\[([0-9;]*)([mAJ])", output):
        code, command = match.groups()
        if command != "m":
            assert not active, f"Color active during cursor movement: {output!r}"
        elif code in ("", "0"):
            active = False
        else:
            assert not active or composite, f"Missing reset before {match.group()!r}: {output!r}"
            active = True
    assert not active, f"Color leaked after exit: {output!r}"
    assert "\x1b" not in re.sub(r"\x1b\[[0-9;]*[mAJ]", "", output), output


def visible_text(output):
    lines, row, column = [[]], 0, 0
    tokens = re.finditer(r"\x1b\[([0-9;]*)([mAJ])|([^\x1b])", output)
    for token in tokens:
        code, command, char = token.groups()
        if command == "A":
            row = max(0, row - int(code or 1))
        elif command == "J":
            lines[row] = lines[row][:column]
            del lines[row + 1:]
        elif command == "m":
            pass
        elif char == "\r":
            column = 0
        elif char == "\n":
            row += 1
            column = 0
            while len(lines) <= row:
                lines.append([])
        elif char:
            while len(lines[row]) <= column:
                lines[row].append(" ")
            lines[row][column] = char
            column += 1
    return "\n".join("".join(line).rstrip() for line in lines).rstrip()
