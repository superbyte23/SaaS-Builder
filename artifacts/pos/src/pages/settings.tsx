import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { useGetOrganization, useUpdateOrganization } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const settingsSchema = z.object({
  name: z.string().min(2, { message: "Organization name is required" }),
  businessType: z.string(),
  currency: z.string(),
  timezone: z.string(),
  taxRate: z.coerce.number().min(0).max(100),
  receiptHeader: z.string().optional(),
  receiptFooter: z.string().optional(),
});

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const orgId = user?.organizationId || 1;
  
  const { data: org, isLoading } = useGetOrganization(orgId, {
    query: {
      queryKey: ["organization", orgId],
      enabled: !!user?.organizationId,
    }
  });
  
  const updateOrg = useUpdateOrganization();

  const form = useForm<z.infer<typeof settingsSchema>>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      name: "",
      businessType: "retail",
      currency: "USD",
      timezone: "UTC",
      taxRate: 10,
      receiptHeader: "",
      receiptFooter: "",
    },
  });

  // Update form when data loads
  useEffect(() => {
    if (org) {
      form.reset({
        name: org.name || "",
        businessType: org.businessType || "retail",
        currency: org.currency || "USD",
        timezone: org.timezone || "UTC",
        taxRate: org.taxRate || 10,
        receiptHeader: org.receiptHeader || "",
        receiptFooter: org.receiptFooter || "",
      });
    }
  }, [org, form]);

  function onSubmit(values: z.infer<typeof settingsSchema>) {
    updateOrg.mutate(
      { id: orgId, data: values },
      {
        onSuccess: () => {
          toast({
            title: "Settings updated",
            description: "Your organization settings have been saved.",
          });
        },
        onError: (error: any) => {
          toast({
            variant: "destructive",
            title: "Failed to update settings",
            description: error.message || "An error occurred. Please try again.",
          });
        }
      }
    );
  }

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex h-[50vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">Manage your organization preferences.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Organization Details</CardTitle>
            <CardDescription>
              Update your business information and localization settings.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Organization Name</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="businessType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Business Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="retail">Retail</SelectItem>
                            <SelectItem value="grocery">Grocery</SelectItem>
                            <SelectItem value="pharmacy">Pharmacy</SelectItem>
                            <SelectItem value="restaurant">Restaurant</SelectItem>
                            <SelectItem value="cafe">Cafe</SelectItem>
                            <SelectItem value="salon">Salon</SelectItem>
                            <SelectItem value="service">Service</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="currency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Currency</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select currency" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="USD">USD ($)</SelectItem>
                            <SelectItem value="EUR">EUR (€)</SelectItem>
                            <SelectItem value="GBP">GBP (£)</SelectItem>
                            <SelectItem value="CAD">CAD (£)</SelectItem>
                            <SelectItem value="AUD">CAD ($)</SelectItem>
                            <SelectItem value="JPY">AUD ($)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="taxRate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Default Tax Rate (%)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <div className="space-y-4 pt-4 border-t">
                  <h3 className="text-lg font-medium">Receipt Configuration</h3>
                  <FormField
                    control={form.control}
                    name="receiptHeader"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Receipt Header</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Store Name, Address, Phone Number..." 
                            className="resize-none" 
                            {...field} 
                            value={field.value || ""}
                          />
                        </FormControl>
                        <FormDescription>Text printed at the top of customer receipts.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="receiptFooter"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Receipt Footer</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Thank you for your business!" 
                            className="resize-none" 
                            {...field} 
                            value={field.value || ""}
                          />
                        </FormControl>
                        <FormDescription>Text printed at the bottom of customer receipts.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-end pt-4">
                  <Button type="submit" disabled={updateOrg.isPending}>
                    {updateOrg.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Changes
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
