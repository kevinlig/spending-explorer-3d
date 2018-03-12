function currentFY() {
    const today = new Date();
    const month = dateFns.getMonth(today);
    if (month > 9) {
        return dateFns.getYear(today) + 1;
    }
    return dateFns.getYear(today);
}
