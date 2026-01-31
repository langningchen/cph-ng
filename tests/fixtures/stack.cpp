void recursion(int depth = 1)
{
    volatile char buffer[1024 * 1024];
    buffer[0] = 0;
    if (depth < 64)
        recursion(depth + 1);
    buffer[0] = 1;
}
int main()
{
    recursion();
    return 0;
}
